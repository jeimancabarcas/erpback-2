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
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { PurchaseOrderSupportDocument } from './purchase-order-support-document.entity';
import { PurchaseOrderAdjustmentNote } from './purchase-order-adjustment-note.entity';

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  orderNumber: string;

  @Column({ type: 'timestamp' })
  orderDate: Date;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @Column({ type: 'varchar', default: 'CREATED' })
  status: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ name: 'support_file_url', type: 'varchar', nullable: true })
  supportFileUrl: string | null;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, {
    cascade: true,
  })
  items: PurchaseOrderItem[];

  @OneToMany(() => PurchaseOrderSupportDocument, (doc) => doc.purchaseOrder)
  supportDocuments: PurchaseOrderSupportDocument[];

  @OneToMany(() => PurchaseOrderAdjustmentNote, (note) => note.purchaseOrder)
  adjustmentNotes: PurchaseOrderAdjustmentNote[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
