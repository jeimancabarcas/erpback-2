import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { PurchaseOrderAdjustmentNote } from './purchase-order-adjustment-note.entity';
import { Product } from '../../inventory/entities/product.entity';
import { PurchaseOrderAdjustmentNoteItemTax } from './purchase-order-adjustment-note-item-tax.entity';

@Entity('purchase_order_adjustment_note_items')
export class PurchaseOrderAdjustmentNoteItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'code_reference', type: 'varchar' })
  codeReference: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ name: 'product_id', nullable: true })
  productId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ default: false })
  consumed: boolean;

  @ManyToOne(() => PurchaseOrderAdjustmentNote, (note) => note.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'adjustment_note_id' })
  adjustmentNote: PurchaseOrderAdjustmentNote;

  @Column({ name: 'adjustment_note_id' })
  adjustmentNoteId: string;

  @ManyToOne(() => Product, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @OneToMany(
    () => PurchaseOrderAdjustmentNoteItemTax,
    (tax) => tax.adjustmentNoteItem,
    {
      cascade: true,
    },
  )
  noteItemTaxes: PurchaseOrderAdjustmentNoteItemTax[];
}
