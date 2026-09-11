import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Configuracao editavel pela tela (chave/valor).
 *
 * Nao vive no .env de proposito: o usuario precisa ajustar o percentual de
 * imposto sem reiniciar a aplicacao nem abrir arquivo.
 */
@Entity('configuracoes')
export class Configuracao {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'chave', type: 'varchar', length: 60, unique: true })
  chave!: string;

  @Column({ name: 'valor', type: 'text' })
  valor!: string;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;
}

export const CHAVE_IMPOSTO = 'imposto_percentual';
