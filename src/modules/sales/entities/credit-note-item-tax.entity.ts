import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CreditNoteItem } from './credit-note-item.entity';
import { Tax } from '../../settings/entities/tax.entity';

@Entity('credit_note_item_taxes')
export class CreditNoteItemTax {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CreditNoteItem, (item) => item.noteItemTaxes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'credit_note_item_id' })
  creditNoteItem: CreditNoteItem;

  @Column({ name: 'credit_note_item_id' })
  creditNoteItemId: string;

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
