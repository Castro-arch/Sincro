import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AtributoDto } from './create-product.dto';

/**
 * Variacao na edicao. `variationId` presente = atualiza a existente; ausente =
 * cria nova (so permitido enquanto o anuncio for rascunho, porque o ML nao
 * aceita acrescentar combinacao em item publicado pelo mesmo caminho).
 */
export class UpdateVariationDto {
  @IsUUID()
  @IsOptional()
  variationId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  sku?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AtributoDto)
  @IsOptional()
  atributos?: AtributoDto[];

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  preco?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  estoque?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pictureIds?: string[];
}

export class UpdateProductDto {
  // ---------- produto interno (sempre editavel; o ML nao conhece estes) ----------
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  custoUnitario?: number | null;

  // ---------- anuncio ----------
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  titulo?: string;

  /** So aceito em rascunho: o ML recusa com item.category_id.not_modifiable. */
  @IsString()
  @IsOptional()
  categoriaId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AtributoDto)
  @IsOptional()
  atributos?: AtributoDto[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(12)
  @IsOptional()
  pictureIds?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateVariationDto)
  @IsOptional()
  variacoes?: UpdateVariationDto[];
}

/** Atualizacao do custo isolada -- serve para produto sem anuncio nenhum. */
export class UpdateCustoDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  custoUnitario?: number | null;
}
