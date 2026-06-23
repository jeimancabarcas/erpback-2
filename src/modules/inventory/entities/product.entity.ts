import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { InventoryCategory } from './inventory-category.entity';
import { Tax } from '../../settings/entities/tax.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  sku: string;

  @Column({ type: 'int', default: 0 })
  currentStock: number;

  @Column({ type: 'int', default: 0 })
  minStock: number;

  @Column({ type: 'int', default: 0 })
  maxStock: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  averagePurchasePrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  sellingPrice: number;

  @ManyToOne(() => InventoryCategory, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: InventoryCategory;

  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @ManyToMany(() => Tax)
  @JoinTable({
    name: 'products_taxes',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tax_id', referencedColumnName: 'id' },
  })
  taxes: Tax[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
