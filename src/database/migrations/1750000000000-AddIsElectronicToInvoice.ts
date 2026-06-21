import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsElectronicToInvoice1750000000000 implements MigrationInterface {
  name = 'AddIsElectronicToInvoice1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN "is_electronic" BOOLEAN NOT NULL DEFAULT TRUE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP COLUMN "is_electronic"`,
    );
  }
}
