import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '../products/entities/listing.entity';
import { Variation } from '../products/entities/variation.entity';
import { Order } from '../orders/entities/order.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { MercadoLivreModule } from '../mercado-livre/mercado-livre.module';

@Module({
  imports: [TypeOrmModule.forFeature([Listing, Variation, Order]), MercadoLivreModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
