import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Listing } from './listing.entity';

/**
 * Produto interno -- a fonte de verdade do catalogo. Existe independente de
 * ter (ou nao) um anuncio publicado no Mercado Livre.
 */
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'sku', type: 'varchar', length: 80, unique: true })
  sku!: string;

  @Column({ name: 'nome', type: 'varchar', length: 200 })
  nome!: string;

  @Column({ name: 'descricao', type: 'text', nullable: true })
  descricao!: string | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;

  @OneToMany(() => Listing, (listing) => listing.product, { cascade: false })
  listings!: Listing[];
}
