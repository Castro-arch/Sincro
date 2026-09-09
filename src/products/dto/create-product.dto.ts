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
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Atributo do item no formato esperado pelo ML: id + valor (nome ou id). */
export class AtributoDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsOptional()
  value_name?: string;

  @IsString()
  @IsOptional()
  value_id?: string;
}

/** Uma combinacao vendavel (ex.: Cor=Azul / Tamanho=M). */
export class CreateVariationDto {
  @IsString()
  @IsOptional()
  @MaxLength(80)
  sku?: string;

  /**
   * attribute_combinations do ML. Vazio significa anuncio sem variacoes --
   * o Sincro guarda esse caso como uma unica variacao sem combinacoes.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AtributoDto)
  atributos!: AtributoDto[];

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  preco!: number;

  @IsInt()
  @Min(0)
  estoque!: number;

  /** Ids de imagens ja enviadas via POST /ml/pictures/upload. */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pictureIds?: string[];
}

export class CreateProductDto {
  // ---------- produto interno ----------
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sku!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nome!: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  // ---------- anuncio ----------
  /** Titulo do anuncio no ML. Se omitido, usa `nome`. */
  @IsString()
  @IsOptional()
  @MaxLength(200)
  titulo?: string;

  /**
   * Categoria do ML. Opcional no rascunho -- o predictor sugere em
   * GET /ml/categories/predict -- mas obrigatoria para publicar.
   */
  @IsString()
  @IsOptional()
  categoriaId?: string;

  @IsString()
  @IsOptional()
  listingTypeId?: string;

  @IsString()
  @IsOptional()
  condicao?: string;

  @IsString()
  @IsOptional()
  moeda?: string;

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
  @Type(() => CreateVariationDto)
  variacoes!: CreateVariationDto[];
}
