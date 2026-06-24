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
import { InvoiceItem } from './invoice-item.entity';
import { CreditNote } from './credit-note.entity';
import { DebitNote } from './debit-note.entity';
import { InvoiceElectronicEmission } from './invoice-electronic-emission.entity';

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
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

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @OneToMany(() => CreditNote, (cn) => cn.invoice)
  creditNotes: CreditNote[];

  @OneToMany(() => DebitNote, (dn) => dn.invoice)
  debitNotes: DebitNote[];

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

  @Column({ name: 'factus_reference_code', type: 'varchar', nullable: true })
  factusReferenceCode?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
