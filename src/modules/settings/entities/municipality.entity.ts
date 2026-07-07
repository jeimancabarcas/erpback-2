import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('municipalities')
export class Municipality {
  @PrimaryColumn({ type: 'varchar', length: 5 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  department: string;
}
