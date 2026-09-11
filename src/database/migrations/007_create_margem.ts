import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMargem1735000007000 implements MigrationInterface {
  name = 'CreateMargem1735000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Comissao efetivamente cobrada pelo ML, vinda de order_items[].sale_fee.
    // Nula em pedido antigo: a doc avisa que o campo pode nao estar presente,
    // e a comissao so e calculada na acreditacao do pagamento.
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "taxa_ml" numeric(12,2)`);

    // Quanto se pagou pelo produto. Nula de proposito: sem custo informado o
    // relatorio marca "sem custo" em vez de fingir que o lucro e a receita.
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN "custo_unitario" numeric(12,2)`);

    // Chave/valor para o relatorio nao precisar de migration a cada ajuste.
    await queryRunner.query(`
      CREATE TABLE "configuracoes" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "chave"         varchar(60) NOT NULL,
        "valor"         text NOT NULL,
        "atualizado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_configuracoes_chave" UNIQUE ("chave")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "configuracoes" ("chave", "valor") VALUES ('imposto_percentual', '0')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "configuracoes"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "custo_unitario"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "taxa_ml"`);
  }
}
