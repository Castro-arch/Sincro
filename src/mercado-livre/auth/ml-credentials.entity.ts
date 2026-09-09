import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Credenciais do Mercado Livre. O sistema e de uso pessoal (um unico vendedor),
 * entao existe no maximo UMA linha nesta tabela -- garantida pela coluna
 * `singleton`, que tem constraint UNIQUE e valor fixo `true`.
 */
@Entity('ml_credentials')
export class MlCredentials {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'singleton', type: 'boolean', default: true, unique: true })
  singleton!: boolean;

  /** user_id do vendedor no ML -- necessario para consultar pedidos. */
  @Column({ name: 'ml_user_id', type: 'bigint', nullable: true })
  mlUserId!: string | null;

  @Column({ name: 'nickname', type: 'varchar', length: 120, nullable: true })
  nickname!: string | null;

  @Column({ name: 'access_token', type: 'text' })
  accessToken!: string;

  @Column({ name: 'refresh_token', type: 'text' })
  refreshToken!: string;

  /** Momento em que o access_token expira (ML entrega ~6h de validade). */
  @Column({ name: 'expira_em', type: 'timestamptz' })
  expiraEm!: Date;

  @Column({ name: 'scope', type: 'text', nullable: true })
  scope!: string | null;

  @Column({ name: 'token_type', type: 'varchar', length: 40, nullable: true })
  tokenType!: string | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;
}
