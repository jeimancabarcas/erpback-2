import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreditColumnsToCustomers1700000000000 implements MigrationInterface {
  name = 'AddCreditColumnsToCustomers1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE customers 
       ADD COLUMN credit_limit DECIMAL(12,2) NULL,
       ADD COLUMN current_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
       ADD COLUMN payment_terms_days INT NOT NULL DEFAULT 30,
       ADD COLUMN credit_status VARCHAR(10) NOT NULL DEFAULT 'GOOD'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE customers 
       DROP COLUMN credit_status,
       DROP COLUMN payment_terms_days,
       DROP COLUMN current_balance,
       DROP COLUMN credit_limit`,
    );
  }
}
