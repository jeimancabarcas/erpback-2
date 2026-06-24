import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InvoiceItem } from './invoice-item.entity';

@Entity('invoice_item_taxes')
export class InvoiceItemTax {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => InvoiceItem, (item) => item.invoiceItemTaxes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_item_id' })
  invoiceItem: InvoiceItem;

  @Column({ name: 'invoice_item_id' })
  invoiceItemId: string;

  @Column({ name: 'tax_id', nullable: true })
  taxId: string;

  @Column({ length: 10 })
  taxCode: string;

  @Column({ length: 100, nullable: true })
  taxName: string;

  @Column('decimal', { precision: 5, scale: 2 })
  taxRate: number;

  @Column('decimal', { precision: 12, scale: 2 })
  taxAmount: number;
}
