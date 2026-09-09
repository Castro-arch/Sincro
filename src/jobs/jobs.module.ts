import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { MercadoLivreModule } from '../mercado-livre/mercado-livre.module';
import { OrdersModule } from '../orders/orders.module';
import { TOKEN_REFRESH_QUEUE, TokenRefreshProcessor } from './token-refresh.processor';
import { ORDER_POLLING_QUEUE, OrderPollingProcessor } from './order-polling.processor';

/**
 * Jobs recorrentes do Sincro, em BullMQ sobre Redis.
 *
 * O agendamento e feito com `upsertJobScheduler`: o agendador e identificado
 * por um id fixo, entao trocar o cron no .env substitui o agendamento antigo
 * em vez de acumular repeticoes duplicadas a cada boot.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: 50,
          removeOnFail: 200,
        },
      }),
    }),
    BullModule.registerQueue({ name: TOKEN_REFRESH_QUEUE }, { name: ORDER_POLLING_QUEUE }),
    MercadoLivreModule,
    OrdersModule,
  ],
  providers: [TokenRefreshProcessor, OrderPollingProcessor],
  exports: [BullModule],
})
export class JobsModule implements OnModuleInit {
  private readonly logger = new Logger(JobsModule.name);

  constructor(
    @InjectQueue(TOKEN_REFRESH_QUEUE) private readonly tokenQueue: Queue,
    @InjectQueue(ORDER_POLLING_QUEUE) private readonly ordersQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const tokenCron = this.config.get<string>('TOKEN_REFRESH_CRON') ?? '*/15 * * * *';
    const ordersCron = this.config.get<string>('ORDER_POLLING_CRON') ?? '*/5 * * * *';

    await this.tokenQueue.upsertJobScheduler(
      'token-refresh-scheduler',
      { pattern: tokenCron },
      { name: 'renovar-token' },
    );

    await this.ordersQueue.upsertJobScheduler(
      'order-polling-scheduler',
      { pattern: ordersCron },
      { name: 'buscar-pedidos' },
    );

    this.logger.log(
      `Jobs agendados -- renovacao de token: "${tokenCron}", polling de pedidos: "${ordersCron}".`,
    );
  }
}
