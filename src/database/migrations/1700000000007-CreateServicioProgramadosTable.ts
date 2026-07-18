import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateServicioProgramadosTable1700000000007 implements MigrationInterface {
  name = 'CreateServicioProgramadosTable1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type
    await queryRunner.query(`
      CREATE TYPE "servicio_programado_estado_enum" AS ENUM ('PENDIENTE', 'INICIADO', 'PAUSADO', 'FINALIZADO', 'CANCELADO')
    `);

    // Create servicio_programados table
    await queryRunner.createTable(
      new Table({
        name: 'servicio_programados',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'customer_id',
            type: 'uuid',
          },
          {
            name: 'servicio_id',
            type: 'uuid',
          },
          {
            name: 'estado',
            type: 'servicio_programado_estado_enum',
            default: "'PENDIENTE'",
          },
          {
            name: 'fecha_inicio',
            type: 'timestamp',
          },
          {
            name: 'fecha_fin',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'total_horas',
            type: 'float',
            isNullable: true,
          },
          {
            name: 'notas',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'motivo_estado',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_sp_customer',
            columnNames: ['customer_id'],
            referencedTableName: 'customers',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'FK_sp_servicio',
            columnNames: ['servicio_id'],
            referencedTableName: 'servicios',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    // Create indexes for servicio_programados
    await queryRunner.createIndex(
      'servicio_programados',
      new TableIndex({
        name: 'IDX_sp_estado',
        columnNames: ['estado'],
      }),
    );

    await queryRunner.createIndex(
      'servicio_programados',
      new TableIndex({
        name: 'IDX_sp_customer_id',
        columnNames: ['customer_id'],
      }),
    );

    await queryRunner.createIndex(
      'servicio_programados',
      new TableIndex({
        name: 'IDX_sp_servicio_id',
        columnNames: ['servicio_id'],
      }),
    );

    await queryRunner.createIndex(
      'servicio_programados',
      new TableIndex({
        name: 'IDX_sp_fecha_inicio',
        columnNames: ['fecha_inicio'],
      }),
    );

    await queryRunner.createIndex(
      'servicio_programados',
      new TableIndex({
        name: 'IDX_sp_customer_fecha',
        columnNames: ['customer_id', 'fecha_inicio'],
      }),
    );

    // Create servicio_programado_insumos table
    await queryRunner.createTable(
      new Table({
        name: 'servicio_programado_insumos',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'servicio_programado_id',
            type: 'uuid',
          },
          {
            name: 'insumo_id',
            type: 'uuid',
          },
          {
            name: 'cantidad',
            type: 'float',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_spinsumo_programado',
            columnNames: ['servicio_programado_id'],
            referencedTableName: 'servicio_programados',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_spinsumo_insumo',
            columnNames: ['insumo_id'],
            referencedTableName: 'insumos',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    // Create indexes for servicio_programado_insumos
    await queryRunner.createIndex(
      'servicio_programado_insumos',
      new TableIndex({
        name: 'IDX_spinsumo_programado_id',
        columnNames: ['servicio_programado_id'],
      }),
    );

    await queryRunner.createIndex(
      'servicio_programado_insumos',
      new TableIndex({
        name: 'IDX_spinsumo_insumo_id',
        columnNames: ['insumo_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('servicio_programado_insumos');
    await queryRunner.dropTable('servicio_programados');
    await queryRunner.query(`DROP TYPE "servicio_programado_estado_enum"`);
  }
}
