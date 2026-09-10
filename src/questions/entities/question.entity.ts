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
import { Listing } from '../../products/entities/listing.entity';

/** Status de pergunta do ML, guardados crus (api_version=4). */
export enum QuestionStatus {
  UNANSWERED = 'UNANSWERED',
  ANSWERED = 'ANSWERED',
  CLOSED_UNANSWERED = 'CLOSED_UNANSWERED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  BANNED = 'BANNED',
  DELETED = 'DELETED',
  DISABLED = 'DISABLED',
}

/**
 * Pergunta de comprador recebida no Mercado Livre.
 *
 * `ml_question_id` e unico: e a chave de idempotencia do polling, como o
 * idx_orders_dedup dos pedidos. `listing_id` e nulo quando o anuncio nao
 * nasceu no Sincro -- a pergunta ainda aparece, so sem o contexto do produto.
 */
@Entity('ml_questions')
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_ml_questions_ml_question_id', { unique: true })
  @Column({ name: 'ml_question_id', type: 'bigint' })
  mlQuestionId!: string;

  @Index('idx_ml_questions_ml_item_id')
  @Column({ name: 'ml_item_id', type: 'varchar', length: 40 })
  mlItemId!: string;

  @Column({ name: 'listing_id', type: 'uuid', nullable: true })
  listingId!: string | null;

  @ManyToOne(() => Listing, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing | null;

  /** So o id: a busca do ML nao traz nome de comprador em itens comuns. */
  @Column({ name: 'from_user_id', type: 'bigint', nullable: true })
  fromUserId!: string | null;

  @Column({ name: 'texto', type: 'text' })
  texto!: string;

  @Index('idx_ml_questions_status')
  @Column({ name: 'status', type: 'varchar', length: 24 })
  status!: QuestionStatus;

  @Column({ name: 'resposta_texto', type: 'text', nullable: true })
  respostaTexto!: string | null;

  @Column({ name: 'resposta_status', type: 'varchar', length: 24, nullable: true })
  respostaStatus!: string | null;

  @Column({ name: 'respondida_em', type: 'timestamptz', nullable: true })
  respondidaEm!: Date | null;

  /** Distingue resposta dada aqui de resposta dada pelo painel do ML. */
  @Column({ name: 'respondida_pelo_sincro', type: 'boolean', default: false })
  respondidaPeloSincro!: boolean;

  /** date_created no ML -- a idade da pergunta conta a partir daqui. */
  @Column({ name: 'data_pergunta', type: 'timestamptz' })
  dataPergunta!: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;
}
