import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CreditNote } from './credit-note.entity';

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
}
