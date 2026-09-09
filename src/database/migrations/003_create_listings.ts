import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateListings1735000003000 implements MigrationInterface {
  name = 'CreateListings1735000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ml_listings" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "product_id"      uuid NOT NULL,
        "ml_item_id"      varchar(40),
        "titulo"          varchar(200) NOT NULL,
        "status"          varchar(20) NOT NULL DEFAULT 'rascunho',
        "categoria_id"    varchar(40),
        "listing_type_id" varchar(40) NOT NULL DEFAULT 'gold_special',
        "condicao"        varchar(20) NOT NULL DEFAULT 'new',
        "moeda"           varchar(8) NOT NULL DEFAULT 'BRL',
        "descricao"       text,
        "atributos"       jsonb NOT NULL DEFAULT '[]'::jsonb,
        "picture_ids"     jsonb NOT NULL DEFAULT '[]'::jsonb,
        "permalink"       varchar(300),
        "ultimo_erro"     text,
        "sincronizado_em" timestamptz,
        "criado_em"       timestamptz NOT NULL DEFAULT now(),
        "atualizado_em"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_ml_listings_product"
          FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_ml_listings_ml_item_id"
        ON "ml_listings" ("ml_item_id") WHERE "ml_item_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_ml_listings_product_id" ON "ml_listings" ("product_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_ml_listings_status" ON "ml_listings" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ml_listings"`);
  }
}
