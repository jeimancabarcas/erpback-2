import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentRecordsTable1700000000002
  implements MigrationInterface
{
  name = 'CreatePaymentRecordsTable1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE payment_records (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        amount DECIMAL(12,2) NOT NULL,
        payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
        notes TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_payment_records_customer_date ON payment_records(customer_id, payment_date)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_payment_records_invoice ON payment_records(invoice_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payment_records_invoice`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_payment_records_customer_date`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS payment_records`);
  }
}
