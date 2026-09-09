import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMlCredentials1735000001000 implements MigrationInterface {
  name = 'CreateMlCredentials1735000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ml_credentials" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "singleton"     boolean NOT NULL DEFAULT true,
        "ml_user_id"    bigint,
        "nickname"      varchar(120),
        "access_token"  text NOT NULL,
        "refresh_token" text NOT NULL,
        "expira_em"     timestamptz NOT NULL,
        "scope"         text,
        "token_type"    varchar(40),
        "criado_em"     timestamptz NOT NULL DEFAULT now(),
        "atualizado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_ml_credentials_singleton" UNIQUE ("singleton"),
        CONSTRAINT "ck_ml_credentials_singleton" CHECK ("singleton" = true)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ml_credentials"`);
  }
}
