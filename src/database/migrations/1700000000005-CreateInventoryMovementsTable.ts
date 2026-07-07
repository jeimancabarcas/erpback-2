import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateInventoryMovementsTable1700000000005 implements MigrationInterface {
  name = 'CreateInventoryMovementsTable1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inventory_movements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'product_id',
            type: 'uuid',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['In', 'Out'],
          },
          {
            name: 'quantity',
            type: 'int',
          },
          {
            name: 'origin',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'destination',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'reference_type',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'reference_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_movement_product',
            columnNames: ['product_id'],
            referencedTableName: 'products',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_movement_user',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'inventory_movements',
      new TableIndex({
        name: 'IDX_movement_product_date',
        columnNames: ['product_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'inventory_movements',
      new TableIndex({
        name: 'IDX_movement_type',
        columnNames: ['type'],
      }),
    );

    await queryRunner.createIndex(
      'inventory_movements',
      new TableIndex({
        name: 'IDX_movement_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'inventory_movements',
      new TableIndex({
        name: 'IDX_movement_reference',
        columnNames: ['reference_type', 'reference_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('inventory_movements');
  }
}
