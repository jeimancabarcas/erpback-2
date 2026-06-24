import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DebitNoteItem } from './debit-note-item.entity';
import { Tax } from '../../settings/entities/tax.entity';

@Entity('debit_note_item_taxes')
export class DebitNoteItemTax {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DebitNoteItem, (item) => item.noteItemTaxes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'debit_note_item_id' })
  debitNoteItem: DebitNoteItem;

  @Column({ name: 'debit_note_item_id' })
  debitNoteItemId: string;

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

  @ManyToOne(() => Tax, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tax_id' })
  tax: Tax;
}
