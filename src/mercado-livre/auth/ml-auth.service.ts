import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { randomBytes, createHash } from 'node:crypto';
import { MlCredentials } from './ml-credentials.entity';
import { MlTokenResponse, MlUserResponse } from '../ml-api.types';

interface PendingAuthorization {
  codeVerifier: string;
  criadoEm: number;
}

export interface MlAuthStatus {
  conectado: boolean;
  mlUserId: string | null;
  nickname: string | null;
  expiraEm: Date | null;
  expirado: boolean;
  segundosParaExpirar: number | null;
}

/** Autorizacoes iniciadas e ainda nao concluidas expiram em 10 minutos. */
const PENDING_TTL_MS = 10 * 60 * 1000;

/**
 * Teto para conseguir a vez na fila de escrita das credenciais. A secao
 * critica e so um read-modify-write no banco, entao qualquer espera longa
 * significa que algo travou -- e melhor desistir e tentar no proximo ciclo do
 * que segurar a renovacao de token indefinidamente.
 */
const LOCK_CREDENCIAIS_TIMEOUT_MS = 10_000;

/**
 * OAuth 2.0 do Mercado Livre para uma unica conta de vendedor.
 *
 * O ML rotaciona o refresh_token a cada renovacao: o antigo morre no instante
 * em que o novo e emitido. Isso exige duas protecoes, que cobrem coisas
 * diferentes -- vale nao confundir:
 *
 * - `refreshInFlight` impede duas renovacoes SIMULTANEAS, que queimariam duas
 *   rotacoes e invalidariam uma a outra.
 * - `filaCredenciais` serializa TODA escrita de credencial, inclusive a do
 *   callback do OAuth -- que nao e uma renovacao e por isso escapava da trava
 *   acima. Sem ela, uma re-autorizacao feita enquanto o job de renovacao roda
 *   perde a escrita de um dos dois lados (lost update na linha unica), e o
 *   refresh_token descartado ja esta morto do lado do ML.
 *
 * Dentro da fila, a renovacao ainda faz compare-and-set: se o refresh_token
 * armazenado mudou enquanto ela falava com o ML, o resultado dela nasceu velho
 * e e descartado em silencio -- quem gravou por ultimo trouxe um par mais novo.
 */
@Injectable()
export class MlAuthService implements OnModuleInit {
  private readonly logger = new Logger(MlAuthService.name);

  /**
   * state -> code_verifier do PKCE. Fica em memoria de proposito: e um fluxo
   * manual, feito uma vez, e o par so precisa sobreviver ao redirect do
   * navegador. Reiniciar o processo no meio do fluxo apenas obriga a comecar
   * de novo em /ml/auth/login.
   */
  private readonly pendingAuthorizations = new Map<string, PendingAuthorization>();

  private refreshInFlight: Promise<string> | null = null;

  /**
   * Fila que serializa as escritas na linha unica de credenciais. Promise
   * encadeada em vez de lock no banco: e um processo so, e a secao critica e
   * apenas o read-modify-write -- as chamadas ao ML ficam fora dela.
   */
  private filaCredenciais: Promise<void> = Promise.resolve();

  /** Campo (e nao a constante direto) para os testes poderem encurtar. */
  private readonly lockTimeoutMs = LOCK_CREDENCIAIS_TIMEOUT_MS;

  constructor(
    @InjectRepository(MlCredentials)
    private readonly credentialsRepo: Repository<MlCredentials>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const credentials = await this.findCredentials();
    if (!credentials) {
      this.logger.warn(
        'Nenhuma credencial do Mercado Livre encontrada. Acesse GET /ml/auth/login para autorizar a aplicacao.',
      );
      return;
    }
    this.logger.log(
      `Credenciais carregadas (vendedor ${credentials.nickname ?? credentials.mlUserId}). Token expira em ${credentials.expiraEm.toISOString()}.`,
    );
  }

  // ---------------------------------------------------------------- fluxo OAuth

  /**
   * Monta a URL de autorizacao com PKCE (S256) e guarda o code_verifier
   * associado ao `state` que voltara no callback.
   */
  buildAuthorizationUrl(): { url: string; state: string } {
    this.limparPendentesExpiradas();

    const state = randomBytes(16).toString('hex');
    const codeVerifier = randomBytes(48).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    this.pendingAuthorizations.set(state, { codeVerifier, criadoEm: Date.now() });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.getOrThrow<string>('ML_CLIENT_ID'),
      redirect_uri: this.config.getOrThrow<string>('ML_REDIRECT_URI'),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authDomain = this.config.getOrThrow<string>('ML_AUTH_DOMAIN');
    return { url: `${authDomain}/authorization?${params.toString()}`, state };
  }

  /** Troca o `code` do callback pelo par de tokens e persiste as credenciais. */
  async handleCallback(code: string, state: string): Promise<MlAuthStatus> {
    this.limparPendentesExpiradas();

    const pending = this.pendingAuthorizations.get(state);
    if (!pending) {
      throw new BadRequestException(
        'State desconhecido ou expirado. Reinicie a autorizacao em GET /ml/auth/login.',
      );
    }
    this.pendingAuthorizations.delete(state);

    const token = await this.requestToken({
      grant_type: 'authorization_code',
      client_id: this.config.getOrThrow<string>('ML_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('ML_CLIENT_SECRET'),
      code,
      redirect_uri: this.config.getOrThrow<string>('ML_REDIRECT_URI'),
      code_verifier: pending.codeVerifier,
    });

    // Le /users/me ANTES de gravar: assim a autorizacao inteira vira uma unica
    // escrita, em vez de dois saves disputando a linha com o job de renovacao.
    const vendedor = await this.buscarDadosDoVendedor(token.access_token);

    const credentials = await this.comLockDeCredenciais('callback-oauth', () =>
      this.salvarCredenciais(token, vendedor),
    );

    this.logger.log(`Autorizacao concluida para o vendedor ${credentials.mlUserId}.`);
    return this.toStatus(credentials);
  }

  // ------------------------------------------------------------------- tokens

  /**
   * Devolve um access_token utilizavel, renovando de forma transparente se ele
   * ja venceu ou esta perto de vencer.
   */
  async getValidAccessToken(): Promise<string> {
    const credentials = await this.findCredentials();
    if (!credentials) {
      throw new UnauthorizedException(
        'Sincro nao esta autorizado no Mercado Livre. Acesse GET /ml/auth/login.',
      );
    }

    if (this.precisaRenovar(credentials)) {
      return this.refreshAccessToken();
    }

    return credentials.accessToken;
  }

  /**
   * Renova o access_token usando o refresh_token. Chamadas concorrentes
   * compartilham a mesma renovacao em voo.
   */
  async refreshAccessToken(): Promise<string> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.executarRenovacao().finally(() => {
      this.refreshInFlight = null;
    });

    return this.refreshInFlight;
  }

  private async executarRenovacao(): Promise<string> {
    const credentials = await this.findCredentials();
    if (!credentials) {
      throw new UnauthorizedException(
        'Sincro nao esta autorizado no Mercado Livre. Acesse GET /ml/auth/login.',
      );
    }

    const refreshTokenUsado = credentials.refreshToken;
    this.logger.log('Renovando access_token do Mercado Livre...');

    const token = await this.requestToken({
      grant_type: 'refresh_token',
      client_id: this.config.getOrThrow<string>('ML_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('ML_CLIENT_SECRET'),
      refresh_token: refreshTokenUsado,
    });

    return this.comLockDeCredenciais('renovacao-token', async () => {
      const atual = await this.findCredentials();

      // Compare-and-set: se o refresh_token armazenado mudou enquanto o ML
      // respondia, outra escrita (tipicamente o callback de uma
      // re-autorizacao) trouxe um par mais novo. O resultado desta renovacao
      // nasceu velho -- descarta em silencio, sem sobrescrever e sem estourar
      // para quem chamou, e devolve o token vigente, que e valido.
      if (atual && atual.refreshToken !== refreshTokenUsado) {
        this.logger.warn(
          'Renovacao descartada: o refresh_token foi rotacionado por outra escrita enquanto o ML respondia. Mantido o par mais recente.',
        );
        return atual.accessToken;
      }

      const atualizado = await this.salvarCredenciais(token);
      this.logger.log(`Token renovado. Novo vencimento: ${atualizado.expiraEm.toISOString()}.`);

      return atualizado.accessToken;
    });
  }

  /**
   * Entra na fila de escrita das credenciais e roda `tarefa` com exclusividade.
   *
   * O timeout existe porque a fila agora cobre toda escrita, nao so a
   * renovacao: um chamador travado nao pode segurar o job de token para
   * sempre. Quem nao consegue a vez desiste, e o proximo ciclo do cron tenta
   * de novo.
   */
  private async comLockDeCredenciais<T>(rotulo: string, tarefa: () => Promise<T>): Promise<T> {
    let liberar!: () => void;
    const minhaVez = new Promise<void>((resolve) => {
      liberar = resolve;
    });

    // Falha de um dono anterior nao pode travar a fila inteira.
    const anterior = this.filaCredenciais.catch(() => undefined);
    this.filaCredenciais = anterior.then(() => minhaVez);

    let temporizador: NodeJS.Timeout | undefined;
    const conseguiuAVez = await Promise.race([
      anterior.then(() => true),
      new Promise<false>((resolve) => {
        temporizador = setTimeout(() => resolve(false), this.lockTimeoutMs);
      }),
    ]);
    clearTimeout(temporizador);

    if (!conseguiuAVez) {
      liberar();
      throw new ServiceUnavailableException(
        `Escrita de credenciais ocupada por mais de ${this.lockTimeoutMs / 1000}s (${rotulo}). Nova tentativa no proximo ciclo.`,
      );
    }

    try {
      return await tarefa();
    } finally {
      liberar();
    }
  }

  /** True quando o token ja venceu ou vence dentro da margem configurada. */
  precisaRenovar(credentials: MlCredentials): boolean {
    const skewSeconds = this.config.get<number>('TOKEN_REFRESH_SKEW_SECONDS') ?? 1800;
    const limite = Date.now() + skewSeconds * 1000;
    return credentials.expiraEm.getTime() <= limite;
  }

  // ------------------------------------------------------------------ leitura

  async findCredentials(): Promise<MlCredentials | null> {
    return this.credentialsRepo.findOne({ where: { singleton: true } });
  }

  /** user_id do vendedor -- necessario para a busca de pedidos. */
  async getSellerId(): Promise<string> {
    const credentials = await this.findCredentials();
    if (!credentials?.mlUserId) {
      throw new UnauthorizedException(
        'Vendedor do Mercado Livre desconhecido. Refaca a autorizacao em GET /ml/auth/login.',
      );
    }
    return credentials.mlUserId;
  }

  async getStatus(): Promise<MlAuthStatus> {
    const credentials = await this.findCredentials();
    if (!credentials) {
      return {
        conectado: false,
        mlUserId: null,
        nickname: null,
        expiraEm: null,
        expirado: true,
        segundosParaExpirar: null,
      };
    }
    return this.toStatus(credentials);
  }

  // ------------------------------------------------------------------ interno

  private toStatus(credentials: MlCredentials): MlAuthStatus {
    const restante = Math.floor((credentials.expiraEm.getTime() - Date.now()) / 1000);
    return {
      conectado: true,
      mlUserId: credentials.mlUserId,
      nickname: credentials.nickname,
      expiraEm: credentials.expiraEm,
      expirado: restante <= 0,
      segundosParaExpirar: restante,
    };
  }

  private async requestToken(body: Record<string, string>): Promise<MlTokenResponse> {
    const url = `${this.config.getOrThrow<string>('ML_API_URL')}/oauth/token`;

    try {
      const response = await axios.post<MlTokenResponse>(url, new URLSearchParams(body).toString(), {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 20_000,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const data = error.response.data as { message?: string; error?: string };
        const detail = data?.message ?? data?.error ?? error.message;
        // Refresh token invalido ou revogado exige refazer o fluxo manual.
        if (error.response.status === 400 || error.response.status === 401) {
          throw new UnauthorizedException(
            `Mercado Livre recusou a troca de token: ${detail}. Refaca a autorizacao em GET /ml/auth/login.`,
          );
        }
        throw new ServiceUnavailableException(`Falha ao obter token no Mercado Livre: ${detail}`);
      }
      throw new ServiceUnavailableException(
        `Mercado Livre inacessivel ao obter token: ${String(error)}`,
      );
    }
  }

  /**
   * Grava (ou atualiza) a unica linha de credenciais.
   *
   * Deve rodar sempre dentro de `comLockDeCredenciais`: e um read-modify-write
   * da mesma linha, e dois chamadores em paralelo perdem uma das escritas.
   */
  private async salvarCredenciais(
    token: MlTokenResponse,
    vendedor?: { id: string; nickname: string } | null,
  ): Promise<MlCredentials> {
    const existente = await this.findCredentials();

    const credentials =
      existente ?? this.credentialsRepo.create({ singleton: true } as Partial<MlCredentials>);

    credentials.accessToken = token.access_token;
    credentials.refreshToken = token.refresh_token;
    credentials.expiraEm = new Date(Date.now() + token.expires_in * 1000);
    credentials.scope = token.scope ?? null;
    credentials.tokenType = token.token_type ?? null;

    if (vendedor) {
      credentials.mlUserId = vendedor.id;
      credentials.nickname = vendedor.nickname;
    } else if (token.user_id) {
      credentials.mlUserId = String(token.user_id);
    }

    return this.credentialsRepo.save(credentials);
  }

  /**
   * Le /users/me para descobrir id e nickname do vendedor. Falhar aqui nao e
   * fatal: o token ja e valido, e o id pode ser preenchido numa proxima
   * autorizacao.
   */
  private async buscarDadosDoVendedor(
    accessToken: string,
  ): Promise<{ id: string; nickname: string } | null> {
    try {
      const response = await axios.get<MlUserResponse>(
        `${this.config.getOrThrow<string>('ML_API_URL')}/users/me`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 20_000,
        },
      );
      return { id: String(response.data.id), nickname: response.data.nickname };
    } catch (error) {
      this.logger.warn(`Nao foi possivel ler /users/me apos a autorizacao: ${String(error)}`);
      return null;
    }
  }

  private limparPendentesExpiradas(): void {
    const agora = Date.now();
    for (const [state, pending] of this.pendingAuthorizations) {
      if (agora - pending.criadoEm > PENDING_TTL_MS) {
        this.pendingAuthorizations.delete(state);
      }
    }
  }
}
