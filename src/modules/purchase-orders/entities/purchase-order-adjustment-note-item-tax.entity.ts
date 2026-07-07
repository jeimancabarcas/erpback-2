import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PurchaseOrderAdjustmentNoteItem } from './purchase-order-adjustment-note-item.entity';

@Entity('purchase_order_adjustment_note_item_taxes')
export class PurchaseOrderAdjustmentNoteItemTax {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tax_id', nullable: true })
  taxId: string;

  @Column({ name: 'tax_code', type: 'varchar' })
  taxCode: string;

  @Column({ name: 'tax_name', type: 'varchar' })
  taxName: string;

  @Column({ name: 'tax_rate', type: 'decimal', precision: 5, scale: 2 })
  taxRate: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 2 })
  taxAmount: number;

  @ManyToOne(
    () => PurchaseOrderAdjustmentNoteItem,
    (item) => item.noteItemTaxes,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'adjustment_note_item_id' })
  adjustmentNoteItem: PurchaseOrderAdjustmentNoteItem;

  @Column({ name: 'adjustment_note_item_id' })
  adjustmentNoteItemId: string;
}
