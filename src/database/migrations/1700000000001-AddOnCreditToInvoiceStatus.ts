import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOnCreditToInvoiceStatus1700000000001 implements MigrationInterface {
  name = 'AddOnCreditToInvoiceStatus1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."invoices_status_enum" ADD VALUE IF NOT EXISTS 'ON_CREDIT'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from an enum type directly.
    // To revert, create a new enum type without ON_CREDIT and migrate data.
    await queryRunner.query(
      `ALTER TYPE "public"."invoices_status_enum" RENAME TO "invoices_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invoices_status_enum" AS ENUM('DRAFT', 'PAID', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE invoices ALTER COLUMN status TYPE "public"."invoices_status_enum" USING status::text::"public"."invoices_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."invoices_status_enum_old"`);
  }
}
