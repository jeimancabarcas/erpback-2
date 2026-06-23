import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateInvoiceDefaults1750000000001 implements MigrationInterface {
  name = 'UpdateInvoiceDefaults1750000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoices" ALTER COLUMN "is_electronic" SET DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN "factus_number" VARCHAR NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP COLUMN "factus_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ALTER COLUMN "is_electronic" SET DEFAULT true`,
    );
  }
}
