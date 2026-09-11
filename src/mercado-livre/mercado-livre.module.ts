import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MlCredentials } from './auth/ml-credentials.entity';
import { MlAuthService } from './auth/ml-auth.service';
import { MlAuthController } from './auth/ml-auth.controller';
import { MlHttpService } from './ml-http.service';
import { MlCategoryService } from './categories/ml-category.service';
import { MlCategoryController } from './categories/ml-category.controller';
import { MlPictureService } from './pictures/ml-picture.service';
import { MlPictureController } from './pictures/ml-picture.controller';
import { MlItemService } from './items/ml-item.service';
import { MlListingPriceService } from './items/ml-listing-price.service';
import { MlOrderService } from './orders/ml-order.service';
import { MlQuestionService } from './questions/ml-question.service';

/**
 * Tudo que fala com a API do Mercado Livre. Os demais dominios (products,
 * orders, jobs, dashboard) consomem estes servicos e nunca chamam o ML direto.
 */
@Module({
  imports: [TypeOrmModule.forFeature([MlCredentials])],
  controllers: [MlAuthController, MlCategoryController, MlPictureController],
  providers: [
    MlAuthService,
    MlHttpService,
    MlCategoryService,
    MlPictureService,
    MlItemService,
    MlOrderService,
    MlQuestionService,
    MlListingPriceService,
  ],
  exports: [
    MlAuthService,
    MlCategoryService,
    MlPictureService,
    MlItemService,
    MlOrderService,
    MlQuestionService,
    MlListingPriceService,
  ],
})
export class MercadoLivreModule {}
