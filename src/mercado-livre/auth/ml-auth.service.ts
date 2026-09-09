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
 * OAuth 2.0 do Mercado Livre para uma unica conta de vendedor.
 *
 * O ML rotaciona o refresh_token a cada renovacao (o antigo e descartado), por
 * isso toda renovacao precisa persistir o par novo e nunca pode rodar em
 * paralelo -- duas renovacoes simultaneas invalidariam uma a outra. A promessa
 * em `refreshInFlight` serializa isso dentro do processo.
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

    const credentials = await this.persistToken(token);
    await this.preencherDadosDoVendedor(credentials);

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

    this.logger.log('Renovando access_token do Mercado Livre...');

    const token = await this.requestToken({
      grant_type: 'refresh_token',
      client_id: this.config.getOrThrow<string>('ML_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('ML_CLIENT_SECRET'),
      refresh_token: credentials.refreshToken,
    });

    const atualizado = await this.persistToken(token);
    this.logger.log(`Token renovado. Novo vencimento: ${atualizado.expiraEm.toISOString()}.`);

    return atualizado.accessToken;
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

  /** Grava (ou atualiza) a unica linha de credenciais. */
  private async persistToken(token: MlTokenResponse): Promise<MlCredentials> {
    const existente = await this.findCredentials();
    const expiraEm = new Date(Date.now() + token.expires_in * 1000);

    const credentials =
      existente ?? this.credentialsRepo.create({ singleton: true } as Partial<MlCredentials>);

    credentials.accessToken = token.access_token;
    credentials.refreshToken = token.refresh_token;
    credentials.expiraEm = expiraEm;
    credentials.scope = token.scope ?? null;
    credentials.tokenType = token.token_type ?? null;
    if (token.user_id) {
      credentials.mlUserId = String(token.user_id);
    }

    return this.credentialsRepo.save(credentials);
  }

  /** Busca nickname e id do vendedor logo apos a autorizacao inicial. */
  private async preencherDadosDoVendedor(credentials: MlCredentials): Promise<void> {
    try {
      const response = await axios.get<MlUserResponse>(
        `${this.config.getOrThrow<string>('ML_API_URL')}/users/me`,
        {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
          timeout: 20_000,
        },
      );
      credentials.mlUserId = String(response.data.id);
      credentials.nickname = response.data.nickname;
      await this.credentialsRepo.save(credentials);
    } catch (error) {
      // Nao e fatal: o token ja esta salvo e o id pode ser preenchido depois.
      this.logger.warn(`Nao foi possivel ler /users/me apos a autorizacao: ${String(error)}`);
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
