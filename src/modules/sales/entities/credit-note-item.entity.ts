import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { CreditNote } from './credit-note.entity';
import { CreditNoteItemTax } from './credit-note-item-tax.entity';
import { Product } from '../../inventory/entities/product.entity';

@Entity('credit_note_items')
@Index(['creditNoteId'])
export class CreditNoteItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CreditNote, (cn) => cn.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'credit_note_id' })
  creditNote: CreditNote;

  @Column({ name: 'credit_note_id' })
  creditNoteId: string;

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

  @Column({
    name: 'purchase_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  purchasePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ default: false })
  restored: boolean;

  @ManyToOne(() => Product, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @OneToMany(() => CreditNoteItemTax, (tax) => tax.creditNoteItem, {
    cascade: true,
  })
  noteItemTaxes: CreditNoteItemTax[];
}
