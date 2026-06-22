import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DebitNote } from './debit-note.entity';

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
}
