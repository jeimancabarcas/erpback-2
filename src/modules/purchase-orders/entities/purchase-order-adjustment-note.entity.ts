import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { PurchaseOrderSupportDocument } from './purchase-order-support-document.entity';
import { PurchaseOrderAdjustmentNoteItem } from './purchase-order-adjustment-note-item.entity';

@Entity('purchase_order_adjustment_notes')
export class PurchaseOrderAdjustmentNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reference_code', type: 'varchar', unique: true })
  referenceCode: string;

  @Column({ name: 'note_number', type: 'varchar', nullable: true })
  noteNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  cude: string | null;

  @Column({ name: 'correction_concept_code', type: 'varchar' })
  correctionConceptCode: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  observation: string | null;

  @Column({ name: 'qr_url', type: 'varchar', nullable: true })
  qrUrl: string | null;

  @Column({ name: 'public_url', type: 'varchar', nullable: true })
  publicUrl: string | null;

  @ManyToOne(() => PurchaseOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrderSupportDocument, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'support_document_id' })
  supportDocument: PurchaseOrderSupportDocument;

  @Column({ name: 'support_document_id', nullable: true })
  supportDocumentId: string;

  @OneToMany(
    () => PurchaseOrderAdjustmentNoteItem,
    (item) => item.adjustmentNote,
    { cascade: true },
  )
  items: PurchaseOrderAdjustmentNoteItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
