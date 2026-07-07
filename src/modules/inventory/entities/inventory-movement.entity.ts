import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from './product.entity';
import { User } from '../../users/entities/user.entity';

export enum MovementType {
  IN = 'In',
  OUT = 'Out',
}

@Entity('inventory_movements')
@Index(['productId', 'createdAt'])
@Index(['type'])
@Index(['userId'])
@Index(['referenceType', 'referenceId'])
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @Column({
    type: 'enum',
    enum: MovementType,
  })
  type: MovementType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', length: 255 })
  origin: string;

  @Column({ type: 'varchar', length: 255 })
  destination: string;

  @Column({ name: 'reference_type', type: 'varchar', length: 50 })
  referenceType: string;

  @Column({
    name: 'reference_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  referenceId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
