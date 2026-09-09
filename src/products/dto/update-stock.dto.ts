import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/** Novo estoque (valor absoluto) de uma variacao. */
export class UpdateStockDto {
  @IsInt()
  @Min(0)
  estoque!: number;

  /** Opcional: atualiza o preco na mesma operacao. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  preco?: number;
}

export class UpdateStockItemDto extends UpdateStockDto {
  @IsUUID()
  variationId!: string;
}

/** Atualizacao em lote -- um unico PUT no ML no final. */
export class UpdateStockBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateStockItemDto)
  itens!: UpdateStockItemDto[];
}
