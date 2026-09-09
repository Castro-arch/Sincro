import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { AtributoObrigatorio, MlCategoryService } from './ml-category.service';
import { MlCategoryPrediction } from '../ml-api.types';

/**
 * Endpoints de apoio ao formulario de cadastro: sugerir a categoria a partir
 * do titulo e descrever o que aquela categoria exige.
 */
@Controller('ml/categories')
export class MlCategoryController {
  constructor(private readonly categoryService: MlCategoryService) {}

  /** GET /ml/categories/predict?titulo=Camiseta+basica+algodao */
  @Get('predict')
  async prever(
    @Query('titulo') titulo?: string,
    @Query('limite') limite?: string,
  ): Promise<MlCategoryPrediction[]> {
    if (!titulo || titulo.trim().length < 3) {
      throw new BadRequestException('Informe "titulo" com pelo menos 3 caracteres.');
    }
    return this.categoryService.preverCategoria(titulo.trim(), Number(limite) || 5);
  }

  /** GET /ml/categories/MLB1234/attributes?apenasObrigatorios=true */
  @Get(':categoriaId/attributes')
  async atributos(
    @Param('categoriaId') categoriaId: string,
    @Query('apenasObrigatorios') apenasObrigatorios?: string,
  ): Promise<AtributoObrigatorio[]> {
    return apenasObrigatorios === 'true'
      ? this.categoryService.listarObrigatorios(categoriaId)
      : this.categoryService.descreverAtributos(categoriaId);
  }
}
