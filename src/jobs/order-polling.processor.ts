import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrdersService, ResultadoSincronizacao } from '../orders/orders.service';
import { MlAuthService } from '../mercado-livre/auth/ml-auth.service';

export const ORDER_POLLING_QUEUE = 'order-polling';

/**
 * Busca pedidos novos no Mercado Livre e aplica a baixa de estoque.
 *
 * Polling em vez de webhook: com menos de 20 anuncios, uma janela de 5 min e
 * suficiente e evita ter que expor um endpoint publico so para receber
 * notificacao do ML.
 */
@Processor(ORDER_POLLING_QUEUE)
export class OrderPollingProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderPollingProcessor.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly authService: MlAuthService,
  ) {
    super();
  }

  async process(job: Job): Promise<ResultadoSincronizacao | { ignorado: string }> {
    const credentials = await this.authService.findCredentials();

    if (!credentials) {
      this.logger.debug('Sem autorizacao no Mercado Livre -- polling adiado.');
      return { ignorado: 'sem-credenciais' };
    }

    this.logger.debug(`Job ${job.id}: buscando pedidos novos...`);
    return this.ordersService.sincronizarPedidos();
  }
}
