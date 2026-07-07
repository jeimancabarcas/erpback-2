import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';
import { Product } from '../../inventory/entities/product.entity';
import { InvoiceItemTax } from './invoice-item-tax.entity';

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({
    name: 'tax_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  taxAmount: number;

  @OneToMany(() => InvoiceItemTax, (t) => t.invoiceItem, { cascade: true })
  invoiceItemTaxes: InvoiceItemTax[];
}
