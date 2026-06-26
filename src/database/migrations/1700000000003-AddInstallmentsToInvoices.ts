import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstallmentsToInvoices1700000000003 implements MigrationInterface {
    name = 'AddInstallmentsToInvoices1700000000003';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invoices" ADD "installments" integer DEFAULT 1`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "installments"`);
    }
}
