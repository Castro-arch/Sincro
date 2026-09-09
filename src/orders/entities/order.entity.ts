import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Variation } from '../../products/entities/variation.entity';
import { Listing } from '../../products/entities/listing.entity';

export enum OrderStatus {
  PAGO = 'pago',
  PENDENTE = 'pendente',
  CANCELADO = 'cancelado',
}

/**
 * Item de pedido vindo do Mercado Livre. Um pedido do ML pode conter varios
 * itens, entao a chave de idempotencia e (ml_order_id, ml_item_id,
 * ml_variation_id) -- e nao apenas o ml_order_id.
 */
@Index('idx_orders_dedup', ['mlOrderId', 'mlItemId', 'mlVariationId'], { unique: true })
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ml_order_id', type: 'varchar', length: 40 })
  mlOrderId!: string;

  @Column({ name: 'ml_item_id', type: 'varchar', length: 40 })
  mlItemId!: string;

  /** String vazia (e nao NULL) quando o anuncio nao tem variacoes, para o
   *  indice unico de deduplicacao continuar funcionando. */
  @Column({ name: 'ml_variation_id', type: 'varchar', length: 40, default: '' })
  mlVariationId!: string;

  @Column({ name: 'variation_id', type: 'uuid', nullable: true })
  variationId!: string | null;

  @ManyToOne(() => Variation, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'variation_id' })
  variation!: Variation | null;

  @Column({ name: 'listing_id', type: 'uuid', nullable: true })
  listingId!: string | null;

  @ManyToOne(() => Listing, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing | null;

  @Column({ name: 'quantidade', type: 'integer' })
  quantidade!: number;

  @Column({
    name: 'valor',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value === null ? 0 : Number(value)),
    },
  })
  valor!: number;

  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: OrderStatus;

  /** Status cru do ML (paid, cancelled, payment_required...) para auditoria. */
  @Column({ name: 'status_ml', type: 'varchar', length: 40, nullable: true })
  statusMl!: string | null;

  /** Marca se a baixa de estoque ja foi aplicada -- evita baixa dupla. */
  @Column({ name: 'estoque_baixado', type: 'boolean', default: false })
  estoqueBaixado!: boolean;

  /** Data em que o pedido foi criado no ML (nao no Sincro). */
  @Column({ name: 'data_pedido', type: 'timestamptz', nullable: true })
  dataPedido!: Date | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}
