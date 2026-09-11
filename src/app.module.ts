import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { MercadoLivreModule } from './mercado-livre/mercado-livre.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { QuestionsModule } from './questions/questions.module';
import { ConfiguracoesModule } from './configuracoes/configuracoes.module';
import { MargemModule } from './margem/margem.module';
import { JobsModule } from './jobs/jobs.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    MercadoLivreModule,
    ProductsModule,
    OrdersModule,
    QuestionsModule,
    ConfiguracoesModule,
    MargemModule,
    JobsModule,
    DashboardModule,
  ],
})
export class AppModule {}
