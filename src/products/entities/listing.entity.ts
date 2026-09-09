import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { MlAttribute } from '../../common/ml-attribute.type';
import { Variation } from './variation.entity';

export enum ListingStatus {
  /** Criado no Sincro, ainda nao enviado ao ML. */
  RASCUNHO = 'rascunho',
  /** Publicado e ativo no ML. */
  ATIVO = 'ativo',
  PAUSADO = 'pausado',
  ENCERRADO = 'encerrado',
  /** A ultima tentativa de publicacao/sincronizacao falhou. */
  ERRO = 'erro',
}

/**
 * Anuncio no Mercado Livre. Nasce como rascunho dentro do Sincro e passa a
 * ter `mlItemId` depois do POST /items.
 */
@Entity('ml_listings')
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, (product) => product.listings, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  /** Id do anuncio no ML (ex.: MLB1234567890). Nulo enquanto for rascunho. */
  @Index('idx_ml_listings_ml_item_id', { unique: true })
  @Column({ name: 'ml_item_id', type: 'varchar', length: 40, nullable: true })
  mlItemId!: string | null;

  @Column({ name: 'titulo', type: 'varchar', length: 200 })
  titulo!: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: ListingStatus.RASCUNHO,
  })
  status!: ListingStatus;

  @Column({ name: 'categoria_id', type: 'varchar', length: 40, nullable: true })
  categoriaId!: string | null;

  @Column({ name: 'listing_type_id', type: 'varchar', length: 40, default: 'gold_special' })
  listingTypeId!: string;

  @Column({ name: 'condicao', type: 'varchar', length: 20, default: 'new' })
  condicao!: string;

  @Column({ name: 'moeda', type: 'varchar', length: 8, default: 'BRL' })
  moeda!: string;

  @Column({ name: 'descricao', type: 'text', nullable: true })
  descricao!: string | null;

  /** Atributos do item exigidos pela categoria: [{ id, value_name }, ...]. */
  @Column({ name: 'atributos', type: 'jsonb', default: () => "'[]'::jsonb" })
  atributos!: MlAttribute[];

  /** Ids das imagens ja enviadas ao ML (POST /pictures/items/upload). */
  @Column({ name: 'picture_ids', type: 'jsonb', default: () => "'[]'::jsonb" })
  pictureIds!: string[];

  @Column({ name: 'permalink', type: 'varchar', length: 300, nullable: true })
  permalink!: string | null;

  @Column({ name: 'ultimo_erro', type: 'text', nullable: true })
  ultimoErro!: string | null;

  @Column({ name: 'sincronizado_em', type: 'timestamptz', nullable: true })
  sincronizadoEm!: Date | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;

  @OneToMany(() => Variation, (variation) => variation.listing, { cascade: true })
  variations!: Variation[];
}
