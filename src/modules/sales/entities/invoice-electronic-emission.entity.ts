import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('invoice_electronic_emissions')
export class InvoiceElectronicEmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Invoice, (inv) => inv.emission, { nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @Column({ type: 'varchar' })
  number: string;

  @Column({ type: 'varchar', nullable: true })
  cude?: string;

  @Column({ name: 'qr_url', type: 'varchar', nullable: true })
  qrUrl?: string;

  @Column({ name: 'public_url', type: 'varchar', nullable: true })
  publicUrl?: string;

  @Column({ name: 'is_validated', default: false })
  isValidated: boolean;

  @Column({ name: 'validated_at', type: 'timestamp', nullable: true })
  validatedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  numberingRange?: any;

  @Column({ type: 'jsonb', nullable: true })
  items?: any;

  @Column({ type: 'jsonb', nullable: true })
  taxes?: any;

  @Column({ type: 'jsonb', nullable: true })
  totals?: any;

  @Column({ type: 'jsonb', nullable: true })
  links?: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
