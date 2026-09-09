import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVariations1735000004000 implements MigrationInterface {
  name = 'CreateVariations1735000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ml_variations" (
        "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "listing_id"       uuid NOT NULL,
        "ml_variation_id"  varchar(40),
        "sku"              varchar(80),
        "atributos"        jsonb NOT NULL DEFAULT '[]'::jsonb,
        "preco"            numeric(12,2) NOT NULL,
        "estoque"          integer NOT NULL DEFAULT 0,
        "picture_ids"      jsonb NOT NULL DEFAULT '[]'::jsonb,
        "criado_em"        timestamptz NOT NULL DEFAULT now(),
        "atualizado_em"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_ml_variations_listing"
          FOREIGN KEY ("listing_id") REFERENCES "ml_listings"("id") ON DELETE CASCADE,
        CONSTRAINT "ck_ml_variations_estoque_nao_negativo" CHECK ("estoque" >= 0),
        CONSTRAINT "ck_ml_variations_preco_positivo" CHECK ("preco" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_ml_variations_listing_id" ON "ml_variations" ("listing_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_ml_variations_ml_variation_id" ON "ml_variations" ("ml_variation_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ml_variations"`);
  }
}
