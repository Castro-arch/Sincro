import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { MercadoLivreModule } from './mercado-livre/mercado-livre.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { QuestionsModule } from './questions/questions.module';
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
    JobsModule,
    DashboardModule,
  ],
})
export class AppModule {}
