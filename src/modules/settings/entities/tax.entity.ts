import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TaxType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

@Entity('taxes')
export class Tax {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  name: string;

  @Column({ unique: true, length: 20 })
  code: string;

  @Column('decimal', { precision: 5, scale: 2 })
  percentage: number;

  @Column({
    type: 'enum',
    enum: TaxType,
  })
  type: TaxType;

  @Column({ default: false })
  isPurchase: boolean;

  @Column({ default: false })
  isSell: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
