import { BadRequestException, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MlAuthService, MlAuthStatus } from './ml-auth.service';

/**
 * Fluxo OAuth manual do vendedor. Feito uma unica vez:
 *   1. abrir GET /ml/auth/login no navegador
 *   2. autorizar no Mercado Livre
 *   3. o ML redireciona para GET /ml/auth/callback e as credenciais sao salvas
 */
@Controller('ml/auth')
export class MlAuthController {
  constructor(private readonly authService: MlAuthService) {}

  /** Redireciona para a tela de autorizacao do Mercado Livre. */
  @Get('login')
  login(@Res() res: Response): void {
    const { url } = this.authService.buildAuthorizationUrl();
    res.redirect(url);
  }

  /** Igual ao /login, mas devolve a URL em JSON em vez de redirecionar. */
  @Get('login-url')
  loginUrl(): { url: string; state: string } {
    return this.authService.buildAuthorizationUrl();
  }

  /** Callback registrado no DevCenter como redirect_uri. */
  @Get('callback')
  async callback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ): Promise<MlAuthStatus> {
    if (error) {
      throw new BadRequestException(
        `Mercado Livre negou a autorizacao: ${error} - ${errorDescription ?? 'sem detalhes'}`,
      );
    }
    if (!code || !state) {
      throw new BadRequestException('Callback sem "code" ou "state".');
    }

    return this.authService.handleCallback(code, state);
  }

  /** Diagnostico: ha credenciais? o token esta valido? por quanto tempo? */
  @Get('status')
  async status(): Promise<MlAuthStatus> {
    return this.authService.getStatus();
  }

  /** Forca a renovacao do access_token (util para testar o fluxo). */
  @Post('refresh')
  async refresh(): Promise<MlAuthStatus> {
    await this.authService.refreshAccessToken();
    return this.authService.getStatus();
  }
}
