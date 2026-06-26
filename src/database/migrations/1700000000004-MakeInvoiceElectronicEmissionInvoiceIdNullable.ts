import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeInvoiceElectronicEmissionInvoiceIdNullable1700000000004
  implements MigrationInterface
{
  name = 'MakeInvoiceElectronicEmissionInvoiceIdNullable1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoice_electronic_emissions" ALTER COLUMN "invoice_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invoice_electronic_emissions_status_enum" AS ENUM ('pending', 'emitted', 'failed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_electronic_emissions" ADD COLUMN "status" "public"."invoice_electronic_emissions_status_enum" NOT NULL DEFAULT 'pending'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoice_electronic_emissions" DROP COLUMN "status"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."invoice_electronic_emissions_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_electronic_emissions" ALTER COLUMN "invoice_id" SET NOT NULL`,
    );
  }
}
