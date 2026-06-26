import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum DocumentType {
  CC = 'CC',
  NIT = 'NIT',
  CE = 'CE',
  PP = 'PP',
}

export enum CreditStatus {
  GOOD = 'GOOD',
  OVERDUE = 'OVERDUE',
  BLOCKED = 'BLOCKED',
}

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({
    type: 'enum',
    enum: DocumentType,
    default: DocumentType.CC,
  })
  documentType: DocumentType;

  @Column({ unique: true })
  documentNumber: string;

  @Column({
    type: 'enum',
    enum: CustomerStatus,
    default: CustomerStatus.ACTIVE,
  })
  status: CustomerStatus;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  creditLimit: number | null;

  @Column({
    name: 'current_balance',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  currentBalance: number;

  @Column({
    name: 'payment_terms_days',
    type: 'int',
    default: 30,
  })
  paymentTermsDays: number;

  @Column({
    name: 'credit_status',
    type: 'enum',
    enum: CreditStatus,
    default: CreditStatus.GOOD,
  })
  creditStatus: CreditStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
