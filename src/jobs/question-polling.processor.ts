import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QuestionsService, ResultadoSincronizacaoPerguntas } from '../questions/questions.service';
import { MlAuthService } from '../mercado-livre/auth/ml-auth.service';

export const QUESTION_POLLING_QUEUE = 'question-polling';

/**
 * Busca perguntas novas e reconcilia as pendentes.
 *
 * Roda a cada 2 min -- mais curto que o polling de pedidos porque pergunta
 * tem prazo apertado: o proprio ML usa "responder em menos de 1h" como
 * referencia de conversao. O ML nao expoe header de rate limit; 720
 * chamadas/dia cabem em qualquer cota plausivel.
 */
@Processor(QUESTION_POLLING_QUEUE)
export class QuestionPollingProcessor extends WorkerHost {
  private readonly logger = new Logger(QuestionPollingProcessor.name);

  constructor(
    private readonly questionsService: QuestionsService,
    private readonly authService: MlAuthService,
  ) {
    super();
  }

  async process(job: Job): Promise<ResultadoSincronizacaoPerguntas | { ignorado: string }> {
    const credentials = await this.authService.findCredentials();
    if (!credentials) {
      this.logger.debug('Sem autorizacao no Mercado Livre -- polling de perguntas adiado.');
      return { ignorado: 'sem-credenciais' };
    }

    this.logger.debug(`Job ${job.id}: buscando perguntas...`);
    return this.questionsService.sincronizar();
  }

  /** Mesmo motivo dos outros processors: falha silenciosa e sistema que para sem aviso. */
  @OnWorkerEvent('failed')
  aoFalhar(job: Job | undefined, erro: Error): void {
    const maximo = job?.opts?.attempts ?? 1;
    const feitas = job?.attemptsMade ?? 0;
    const restantes = Math.max(maximo - feitas, 0);
    const mensagem = erro?.message ?? String(erro);
    const desfecho =
      restantes > 0
        ? `havera nova tentativa (${restantes} de ${maximo} restante(s))`
        : 'TENTATIVAS ESGOTADAS -- perguntas novas param de aparecer ate a proxima execucao do cron';
    this.logger.error(`Job ${job?.id ?? '?'} falhou: ${mensagem}. ${desfecho}.`);
  }
}
