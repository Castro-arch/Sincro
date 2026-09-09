import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrders1735000005000 implements MigrationInterface {
  name = 'CreateOrders1735000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ml_order_id"     varchar(40) NOT NULL,
        "ml_item_id"      varchar(40) NOT NULL,
        "ml_variation_id" varchar(40) NOT NULL DEFAULT '',
        "variation_id"    uuid,
        "listing_id"      uuid,
        "quantidade"      integer NOT NULL,
        "valor"           numeric(12,2) NOT NULL,
        "status"          varchar(20) NOT NULL,
        "status_ml"       varchar(40),
        "estoque_baixado" boolean NOT NULL DEFAULT false,
        "data_pedido"     timestamptz,
        "criado_em"       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_orders_variation"
          FOREIGN KEY ("variation_id") REFERENCES "ml_variations"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_orders_listing"
          FOREIGN KEY ("listing_id") REFERENCES "ml_listings"("id") ON DELETE SET NULL
      )
    `);
    // Idempotencia do polling: o mesmo item do mesmo pedido nunca entra duas vezes.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_orders_dedup"
        ON "orders" ("ml_order_id", "ml_item_id", "ml_variation_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_orders_data_pedido" ON "orders" ("data_pedido" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "orders"`);
  }
}
