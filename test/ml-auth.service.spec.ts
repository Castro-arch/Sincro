import { UnauthorizedException } from '@nestjs/common';
import { MlAuthService } from '../src/mercado-livre/auth/ml-auth.service';
import { MlCredentials } from '../src/mercado-livre/auth/ml-credentials.entity';

const CONFIG: Record<string, unknown> = {
  ML_CLIENT_ID: '1234567890',
  ML_CLIENT_SECRET: 'segredo',
  ML_REDIRECT_URI: 'http://localhost:3000/ml/auth/callback',
  ML_AUTH_DOMAIN: 'https://auth.mercadolivre.com.br',
  ML_API_URL: 'https://api.mercadolibre.com',
  TOKEN_REFRESH_SKEW_SECONDS: 1800,
};

function credenciais(expiraEmMs: number): MlCredentials {
  return {
    expiraEm: new Date(Date.now() + expiraEmMs),
    accessToken: 'token-atual',
    refreshToken: 'refresh-atual',
  } as MlCredentials;
}

describe('MlAuthService', () => {
  let repo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let service: MlAuthService;

  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (c) => c),
      create: jest.fn().mockImplementation((c) => c),
    };
    const config = {
      get: (chave: string) => CONFIG[chave],
      getOrThrow: (chave: string) => CONFIG[chave],
    };
    service = new MlAuthService(repo as never, config as never);
  });

  describe('buildAuthorizationUrl', () => {
    it('monta a URL com PKCE S256 e um state novo a cada chamada', () => {
      const primeira = service.buildAuthorizationUrl();
      const segunda = service.buildAuthorizationUrl();

      const url = new URL(primeira.url);
      expect(url.origin + url.pathname).toBe('https://auth.mercadolivre.com.br/authorization');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBe('1234567890');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('code_challenge')).toBeTruthy();
      expect(primeira.state).not.toBe(segunda.state);
    });
  });

  describe('handleCallback', () => {
    it('recusa um state que nao foi emitido por este processo', async () => {
      await expect(service.handleCallback('codigo', 'state-forjado')).rejects.toThrow(
        /State desconhecido/,
      );
    });
  });

  describe('precisaRenovar', () => {
    it('renova quando falta menos que a margem configurada', () => {
      // Faltam 10 min; a margem e de 30 min.
      expect(service.precisaRenovar(credenciais(10 * 60 * 1000))).toBe(true);
    });

    it('nao renova token recem-emitido', () => {
      // Token de ~6h recem obtido.
      expect(service.precisaRenovar(credenciais(6 * 60 * 60 * 1000))).toBe(false);
    });

    it('renova token ja vencido', () => {
      expect(service.precisaRenovar(credenciais(-60 * 1000))).toBe(true);
    });
  });

  describe('getValidAccessToken', () => {
    it('devolve o token atual sem tocar no ML quando ele ainda esta longe de vencer', async () => {
      repo.findOne.mockResolvedValue(credenciais(5 * 60 * 60 * 1000));

      await expect(service.getValidAccessToken()).resolves.toBe('token-atual');
    });

    it('exige autorizacao quando nao ha credenciais salvas', async () => {
      await expect(service.getValidAccessToken()).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refreshAccessToken', () => {
    it('serializa chamadas concorrentes numa unica renovacao', async () => {
      repo.findOne.mockResolvedValue(credenciais(60 * 1000));

      let renovacoes = 0;
      // Substitui so a troca HTTP; o resto do caminho continua real.
      const original = Reflect.get(service, 'requestToken');
      Reflect.set(service, 'requestToken', async () => {
        renovacoes++;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          access_token: 'token-novo',
          refresh_token: 'refresh-novo',
          expires_in: 21600,
          token_type: 'Bearer',
        };
      });

      const [a, b, c] = await Promise.all([
        service.refreshAccessToken(),
        service.refreshAccessToken(),
        service.refreshAccessToken(),
      ]);

      expect(renovacoes).toBe(1);
      expect([a, b, c]).toEqual(['token-novo', 'token-novo', 'token-novo']);
      expect(typeof original).toBe('function');
    });
  });
  describe('escrita concorrente de credenciais', () => {
    /** Atalho para exercitar a fila diretamente. */
    const comLock = (
      servico: MlAuthService,
      rotulo: string,
      tarefa: () => Promise<unknown>,
    ): Promise<unknown> =>
      (
        Reflect.get(servico, 'comLockDeCredenciais') as (
          r: string,
          t: () => Promise<unknown>,
        ) => Promise<unknown>
      ).call(servico, rotulo, tarefa);

    it('descarta a renovacao quando o callback gravou um par mais novo durante a chamada ao ML', async () => {
      let armazenado = credenciais(60 * 1000);
      repo.findOne.mockImplementation(async () => armazenado);

      Reflect.set(service, 'requestToken', async () => {
        // Enquanto o ML responde, o callback de uma re-autorizacao grava outro
        // par -- exatamente a janela do lost update.
        armazenado = {
          ...credenciais(6 * 60 * 60 * 1000),
          accessToken: 'token-do-callback',
          refreshToken: 'refresh-do-callback',
        } as MlCredentials;
        return {
          access_token: 'token-da-renovacao',
          refresh_token: 'refresh-da-renovacao',
          expires_in: 21600,
          token_type: 'Bearer',
        };
      });

      const resultado = await service.refreshAccessToken();

      // Descarte silencioso: devolve o par mais novo e nao sobrescreve nada.
      expect(resultado).toBe('token-do-callback');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('persiste normalmente quando ninguem mexeu no refresh_token', async () => {
      repo.findOne.mockResolvedValue(credenciais(60 * 1000));
      Reflect.set(service, 'requestToken', async () => ({
        access_token: 'token-da-renovacao',
        refresh_token: 'refresh-da-renovacao',
        expires_in: 21600,
        token_type: 'Bearer',
      }));

      await expect(service.refreshAccessToken()).resolves.toBe('token-da-renovacao');
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('serializa escritas concorrentes em vez de deixa-las se sobrepor', async () => {
      const ordem: string[] = [];

      await Promise.all([
        comLock(service, 'a', async () => {
          ordem.push('a-inicio');
          await new Promise((resolve) => setTimeout(resolve, 20));
          ordem.push('a-fim');
        }),
        comLock(service, 'b', async () => {
          ordem.push('b-inicio');
          ordem.push('b-fim');
        }),
      ]);

      expect(ordem).toEqual(['a-inicio', 'a-fim', 'b-inicio', 'b-fim']);
    });

    it('desiste da vez apos o timeout, sem travar a fila para sempre', async () => {
      Reflect.set(service, 'lockTimeoutMs', 30);

      let destravar!: () => void;
      const preso = comLock(service, 'travado', async () => {
        await new Promise<void>((resolve) => {
          destravar = resolve;
        });
      });

      await expect(comLock(service, 'segundo', async () => 'nunca roda')).rejects.toThrow(
        /Escrita de credenciais ocupada/,
      );

      // Liberado o primeiro, a fila volta a aceitar escrita.
      destravar();
      await preso;
      await expect(comLock(service, 'terceiro', async () => 'ok')).resolves.toBe('ok');
    });
  });
  describe('resposta do /oauth/token incompleta', () => {
    /**
     * Sem o escopo offline_access o ML devolve token SEM refresh_token. A
     * coluna e NOT NULL, entao sem esta checagem o erro visivel seria uma
     * violacao de constraint do Postgres, que nao menciona escopo nenhum.
     */
    it('acusa a falta de offline_access quando nao vem refresh_token', async () => {
      const semRefresh = {
        access_token: 'APP_USR-123',
        token_type: 'bearer',
        expires_in: 21600,
        scope: 'read write',
      };
      const validar = Reflect.get(service, 'garantirTokenCompleto') as (t: unknown) => void;

      expect(() => validar.call(service, semRefresh)).toThrow(/offline_access/);
      // A mensagem mostra o que de fato veio, para nao virar adivinhacao.
      expect(() => validar.call(service, semRefresh)).toThrow(/read write/);
    });

    it('aceita a resposta completa sem reclamar', () => {
      const validar = Reflect.get(service, 'garantirTokenCompleto') as (t: unknown) => void;

      expect(() =>
        validar.call(service, {
          access_token: 'APP_USR-123',
          refresh_token: 'TG-456',
          token_type: 'bearer',
          expires_in: 21600,
          scope: 'offline_access read write',
        }),
      ).not.toThrow();
    });

    it('nao deixa o tratamento de erro do axios engolir a mensagem', async () => {
      repo.findOne.mockResolvedValue(credenciais(60 * 1000));
      Reflect.set(service, 'requestToken', undefined);

      // Restaura o requestToken real e simula o ML devolvendo token incompleto.
      const axios = require('axios');
      const spy = jest.spyOn(axios, 'post').mockResolvedValue({
        data: { access_token: 'APP_USR-1', token_type: 'bearer', expires_in: 21600 },
      });

      const serviceReal = new MlAuthService(repo as never, {
        get: (c: string) => CONFIG[c],
        getOrThrow: (c: string) => CONFIG[c],
      } as never);

      // A mensagem util precisa sobreviver -- e nao virar "Mercado Livre inacessivel".
      await expect(serviceReal.refreshAccessToken()).rejects.toThrow(/offline_access/);

      spy.mockRestore();
    });
  });
});
