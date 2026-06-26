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

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sequential_number', type: 'int', generated: 'identity' })
  sequentialNumber: number;

  @Column({ name: 'invoice_number', length: 50, nullable: true })
  invoiceNumber?: string;

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

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @Column({ name: 'is_electronic', default: false })
  isElectronic: boolean;

  @OneToOne(() => InvoiceElectronicEmission, (emission) => emission.invoice, {
    nullable: true,
  })
  emission?: InvoiceElectronicEmission;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'installments', type: 'int', default: 1, nullable: true })
  installments?: number;

  @Column({ name: 'factus_reference_code', type: 'varchar', nullable: true })
  factusReferenceCode?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
