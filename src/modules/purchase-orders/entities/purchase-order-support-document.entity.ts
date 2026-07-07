import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';

@Entity('purchase_order_support_documents')
export class PurchaseOrderSupportDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reference_code', type: 'varchar', unique: true })
  referenceCode: string;

  @Column({ name: 'number', type: 'varchar', nullable: true })
  number: string | null;

  @Column({ type: 'varchar', nullable: true })
  cude: string | null;

  @Column({ name: 'qr_url', type: 'varchar', nullable: true })
  qrUrl: string | null;

  @Column({ name: 'public_url', type: 'varchar', nullable: true })
  publicUrl: string | null;

  @ManyToOne(() => PurchaseOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
