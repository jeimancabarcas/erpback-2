import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('debit_notes')
export class DebitNote {
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

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
