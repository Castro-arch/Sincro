import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestions1735000006000 implements MigrationInterface {
  name = 'CreateQuestions1735000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ml_questions" (
        "id"                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ml_question_id"         bigint NOT NULL,
        "ml_item_id"             varchar(40) NOT NULL,
        "listing_id"             uuid,
        "from_user_id"           bigint,
        "texto"                  text NOT NULL,
        "status"                 varchar(24) NOT NULL,
        "resposta_texto"         text,
        "resposta_status"        varchar(24),
        "respondida_em"          timestamptz,
        "respondida_pelo_sincro" boolean NOT NULL DEFAULT false,
        "data_pergunta"          timestamptz NOT NULL,
        "criado_em"              timestamptz NOT NULL DEFAULT now(),
        "atualizado_em"          timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_ml_questions_listing"
          FOREIGN KEY ("listing_id") REFERENCES "ml_listings"("id") ON DELETE SET NULL
      )
    `);
    // Idempotencia do polling: a mesma pergunta nunca entra duas vezes.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_ml_questions_ml_question_id" ON "ml_questions" ("ml_question_id")
    `);
    await queryRunner.query(`CREATE INDEX "idx_ml_questions_status" ON "ml_questions" ("status")`);
    await queryRunner.query(`CREATE INDEX "idx_ml_questions_ml_item_id" ON "ml_questions" ("ml_item_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ml_questions"`);
  }
}
