import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProducts1735000002000 implements MigrationInterface {
  name = 'CreateProducts1735000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sku"           varchar(80) NOT NULL,
        "nome"          varchar(200) NOT NULL,
        "descricao"     text,
        "criado_em"     timestamptz NOT NULL DEFAULT now(),
        "atualizado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_products_sku" UNIQUE ("sku")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
