import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Listing } from './entities/listing.entity';
import { Variation } from './entities/variation.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { MercadoLivreModule } from '../mercado-livre/mercado-livre.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Listing, Variation]), MercadoLivreModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService, TypeOrmModule],
})
export class ProductsModule {}
