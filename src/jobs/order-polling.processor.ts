import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
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

  /**
   * Registra toda falha de job, mesmo quando o BullMQ vai tentar de novo.
   *
   * Sem isto a excecao subia para a fila, que reagenda em silencio, e o log
   * da aplicacao seguia limpo: um sistema que parece saudavel ate parar sem
   * aviso. Aconteceu de verdade em 2026-09-10 -- um `getaddrinfo ENOTFOUND`
   * derrubou uma tentativa e so foi possivel descobrir lendo o stacktrace
   * guardado no Redis.
   *
   * Nota para quem for procurar essa linha: Logger.error escreve em stderr,
   * nao em stdout.
   */
  @OnWorkerEvent('failed')
  aoFalhar(job: Job | undefined, erro: Error): void {
    const maximo = job?.opts?.attempts ?? 1;
    const feitas = job?.attemptsMade ?? 0;
    const restantes = Math.max(maximo - feitas, 0);
    const mensagem = erro?.message ?? String(erro);

    const desfecho =
      restantes > 0
        ? `havera nova tentativa (${restantes} de ${maximo} restante(s))`
        : `TENTATIVAS ESGOTADAS -- pedidos param de ser sincronizados ate a proxima execucao do cron`;

    this.logger.error(`Job ${job?.id ?? '?'} falhou: ${mensagem}. ${desfecho}.`);
  }
}
