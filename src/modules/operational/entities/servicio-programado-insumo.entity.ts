import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ServicioProgramado } from './servicio-programado.entity';
import { Insumo } from './insumo.entity';

@Entity('servicio_programado_insumos')
export class ServicioProgramadoInsumo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ServicioProgramado, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'servicio_programado_id' })
  servicioProgramado: ServicioProgramado;

  @ManyToOne(() => Insumo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'insumo_id' })
  insumo: Insumo;

  @Column({ type: 'float' })
  cantidad: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
