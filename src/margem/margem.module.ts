import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { Listing } from '../products/entities/listing.entity';
import { MargemService } from './margem.service';
import { MargemController } from './margem.controller';
import { ConfiguracoesModule } from '../configuracoes/configuracoes.module';
import { MercadoLivreModule } from '../mercado-livre/mercado-livre.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Listing]), ConfiguracoesModule, MercadoLivreModule],
  controllers: [MargemController],
  providers: [MargemService],
})
export class MargemModule {}
