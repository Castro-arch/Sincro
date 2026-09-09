import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { MlAuthService } from './auth/ml-auth.service';

interface MlErrorBody {
  message?: string;
  error?: string;
  status?: number;
  cause?: Array<{ code?: string; message?: string } | string>;
}

/**
 * Cliente unico para as chamadas autenticadas a API do Mercado Livre.
 *
 * Responsabilidades: injetar o access_token valido, traduzir os erros do ML em
 * HttpException legivel e reagir a 401 renovando o token uma vez antes de
 * desistir.
 */
@Injectable()
export class MlHttpService {
  private readonly logger = new Logger(MlHttpService.name);
  private readonly client: AxiosInstance;

  constructor(
    private readonly auth: MlAuthService,
    config: ConfigService,
  ) {
    this.client = axios.create({
      baseURL: config.getOrThrow<string>('ML_API_URL'),
      timeout: 30_000,
    });
  }

  async get<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T>(url: string, data?: unknown, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async put<T>(url: string, data?: unknown, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  async delete<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  /**
   * Chamada publica (sem Authorization). O predictor de categorias e os
   * atributos de categoria sao endpoints abertos -- nao gastam token nem
   * exigem que o OAuth ja tenha sido feito.
   */
  async getPublic<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    try {
      const response = await this.client.request<T>({ ...config, method: 'GET', url });
      return response.data;
    } catch (error) {
      throw this.translateError(error, `GET ${url}`);
    }
  }

  private async request<T>(config: AxiosRequestConfig, isRetry = false): Promise<T> {
    const token = await this.auth.getValidAccessToken();

    try {
      const response = await this.client.request<T>({
        ...config,
        headers: {
          Accept: 'application/json',
          ...config.headers,
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;

      // Token pode ter sido invalidado do lado do ML antes de expirar.
      // Renova a forca e tenta uma unica vez mais.
      if (status === 401 && !isRetry) {
        this.logger.warn('401 do Mercado Livre -- forcando renovacao do token e repetindo');
        await this.auth.refreshAccessToken();
        return this.request<T>(config, true);
      }

      throw this.translateError(error, `${config.method} ${config.url}`);
    }
  }

  private translateError(error: unknown, context: string): HttpException {
    if (!axios.isAxiosError(error)) {
      return new ServiceUnavailableException(
        `Falha inesperada ao chamar o Mercado Livre (${context}): ${String(error)}`,
      );
    }

    const axiosError = error as AxiosError<MlErrorBody>;

    if (!axiosError.response) {
      return new ServiceUnavailableException(
        `Mercado Livre inacessivel (${context}): ${axiosError.message}`,
      );
    }

    const { status, data } = axiosError.response;
    const causes = (data?.cause ?? [])
      .map((c) => (typeof c === 'string' ? c : (c.message ?? c.code ?? '')))
      .filter(Boolean);

    const detail = [data?.message ?? data?.error ?? axiosError.message, ...causes]
      .filter(Boolean)
      .join(' | ');

    this.logger.error(`Mercado Livre respondeu ${status} em ${context}: ${detail}`);

    // 4xx do ML viram o mesmo 4xx aqui (erro de payload/permissao do vendedor).
    // 5xx viram 502: o problema esta la, nao no Sincro.
    const mapped = status >= 500 ? HttpStatus.BAD_GATEWAY : status;

    return new HttpException(
      {
        statusCode: mapped,
        message: `Mercado Livre: ${detail}`,
        mlStatus: status,
        mlCause: data?.cause ?? null,
      },
      mapped,
    );
  }
}
