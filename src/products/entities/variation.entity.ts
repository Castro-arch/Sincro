import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Listing } from './listing.entity';
import { MlAttribute } from '../../common/ml-attribute.type';

/**
 * Combinacao vendavel de um anuncio (ex.: Cor=Azul / Tamanho=M).
 *
 * `atributos` e JSONB porque as combinacoes validas mudam por categoria --
 * modelar cor/tamanho como colunas fixas quebraria na primeira categoria
 * que usa outro eixo (voltagem, sabor, capacidade...).
 */
@Entity('ml_variations')
export class Variation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @ManyToOne(() => Listing, (listing) => listing.variations, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;

  /** Id da variacao no ML. Nulo enquanto o anuncio nao foi publicado. */
  @Index('idx_ml_variations_ml_variation_id')
  @Column({ name: 'ml_variation_id', type: 'varchar', length: 40, nullable: true })
  mlVariationId!: string | null;

  @Column({ name: 'sku', type: 'varchar', length: 80, nullable: true })
  sku!: string | null;

  /**
   * attribute_combinations no formato do ML:
   * [{ id: 'COLOR', name: 'Cor', value_name: 'Azul' }, ...]
   */
  @Column({ name: 'atributos', type: 'jsonb', default: () => "'[]'::jsonb" })
  atributos!: MlAttribute[];

  @Column({
    name: 'preco',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value === null ? 0 : Number(value)),
    },
  })
  preco!: number;

  @Column({ name: 'estoque', type: 'integer', default: 0 })
  estoque!: number;

  /** Imagens especificas da variacao (subconjunto das do anuncio). */
  @Column({ name: 'picture_ids', type: 'jsonb', default: () => "'[]'::jsonb" })
  pictureIds!: string[];

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;
}
