import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InvoiceItem } from './invoice-item.entity';
import { Tax } from '../../settings/entities/tax.entity';

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

  @ManyToOne(() => Tax, { eager: true })
  @JoinColumn({ name: 'tax_id' })
  tax: Tax;

  @Column({ name: 'tax_id', nullable: true })
  taxId: string;
}
