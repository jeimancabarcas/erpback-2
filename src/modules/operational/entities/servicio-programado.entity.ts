import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { Servicio } from './servicio.entity';
import { ServicioProgramadoInsumo } from './servicio-programado-insumo.entity';

export enum ServicioProgramadoEstado {
  PENDIENTE = 'PENDIENTE',
  INICIADO = 'INICIADO',
  PAUSADO = 'PAUSADO',
  FINALIZADO = 'FINALIZADO',
  CANCELADO = 'CANCELADO',
}

@Entity('servicio_programados')
export class ServicioProgramado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Servicio, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'servicio_id' })
  servicio: Servicio;

  @Column({
    type: 'enum',
    enum: ServicioProgramadoEstado,
    default: ServicioProgramadoEstado.PENDIENTE,
  })
  estado: ServicioProgramadoEstado;

  @Column({ name: 'fecha_inicio', type: 'timestamp' })
  fechaInicioEstimada: Date;

  @Column({ name: 'fecha_fin', type: 'timestamp', nullable: true })
  fechaFinEstimada: Date;

  @Column({ name: 'total_horas', type: 'float', nullable: true })
  totalHoras: number;

  @Column({ type: 'text', nullable: true })
  notas: string;

  @Column({ name: 'motivo_estado', type: 'text', nullable: true })
  motivoEstado: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ServicioProgramadoInsumo, (insumo) => insumo.servicioProgramado)
  insumos: ServicioProgramadoInsumo[];
}
