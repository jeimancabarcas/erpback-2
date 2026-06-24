import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { DebitNote } from './debit-note.entity';
import { DebitNoteItemTax } from './debit-note-item-tax.entity';
import { Product } from '../../inventory/entities/product.entity';

@Entity('debit_note_items')
@Index(['debitNoteId'])
export class DebitNoteItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DebitNote, (dn) => dn.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debit_note_id' })
  debitNote: DebitNote;

  @Column({ name: 'debit_note_id' })
  debitNoteId: string;

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

  @ManyToOne(() => Product, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @OneToMany(() => DebitNoteItemTax, (tax) => tax.debitNoteItem, {
    cascade: true,
  })
  noteItemTaxes: DebitNoteItemTax[];
}
