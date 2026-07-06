import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { PaymentMethod } from '../../settings/entities/payment-method.entity';
import { PaymentType } from '../../settings/entities/payment-type.entity';
import { InvoiceItem } from './invoice-item.entity';
import { CreditNote } from './credit-note.entity';
import { InvoiceElectronicEmission } from './invoice-electronic-emission.entity';

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  ON_CREDIT = 'ON_CREDIT',
}

export enum PaymentFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export const FREQUENCY_DAYS: Record<PaymentFrequency, number> = {
  [PaymentFrequency.DAILY]: 1,
  [PaymentFrequency.WEEKLY]: 7,
  [PaymentFrequency.BIWEEKLY]: 14,
  [PaymentFrequency.MONTHLY]: 30,
  [PaymentFrequency.QUARTERLY]: 90,
  [PaymentFrequency.YEARLY]: 365,
};

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sequential_number', type: 'int', generated: 'identity' })
  sequentialNumber: number;

  @Column({ type: 'timestamp' })
  date: Date;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => PaymentMethod, { nullable: true, eager: true })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod?: PaymentMethod;

  @Column({ name: 'payment_method_id', nullable: true })
  paymentMethodId?: string;

  @ManyToOne(() => PaymentType, { nullable: true, eager: true })
  @JoinColumn({ name: 'payment_type_id' })
  paymentType?: PaymentType;

  @Column({ name: 'payment_type_id', nullable: true })
  paymentTypeId?: string;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @OneToMany(() => CreditNote, (cn) => cn.invoice)
  creditNotes: CreditNote[];

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @OneToOne(() => InvoiceElectronicEmission, (emission) => emission.invoice, {
    nullable: true,
  })
  emission?: InvoiceElectronicEmission;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'installments', type: 'int', default: 1, nullable: true })
  installments?: number;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({
    name: 'payment_frequency',
    type: 'enum',
    enum: PaymentFrequency,
    nullable: true,
  })
  paymentFrequency: PaymentFrequency | null;

  @Column({ name: 'factus_reference_code', type: 'varchar', nullable: true })
  factusReferenceCode?: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
