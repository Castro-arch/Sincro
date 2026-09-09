import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MlAuthService } from '../mercado-livre/auth/ml-auth.service';

export const TOKEN_REFRESH_QUEUE = 'token-refresh';

/**
 * Mantem o access_token do Mercado Livre sempre valido.
 *
 * O token dura ~6h; o job roda a cada 15 min e so renova quando falta menos
 * que TOKEN_REFRESH_SKEW_SECONDS para vencer. Rodar com frequencia e barato
 * (na maioria das vezes nao faz nada) e garante que uma indisponibilidade
 * pontual do ML tenha varias chances de ser recuperada antes do vencimento.
 */
@Processor(TOKEN_REFRESH_QUEUE)
export class TokenRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(TokenRefreshProcessor.name);

  constructor(private readonly authService: MlAuthService) {
    super();
  }

  async process(job: Job): Promise<{ renovado: boolean; motivo?: string }> {
    const credentials = await this.authService.findCredentials();

    if (!credentials) {
      this.logger.debug('Sem credenciais salvas -- nada a renovar.');
      return { renovado: false, motivo: 'sem-credenciais' };
    }

    if (!this.authService.precisaRenovar(credentials)) {
      this.logger.debug(
        `Token ainda valido ate ${credentials.expiraEm.toISOString()} -- renovacao dispensada.`,
      );
      return { renovado: false, motivo: 'ainda-valido' };
    }

    this.logger.log(`Job ${job.id}: token vence em breve, renovando...`);
    await this.authService.refreshAccessToken();

    return { renovado: true };
  }
}
