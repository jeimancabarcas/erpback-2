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
import { ServicioProgramadoInsumo } from './servicio-programado-insumo.entity';
import { ServicioProgramadoActividad } from './servicio-programado-actividad.entity';

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

  // Snapshot del servicio (no referencia la tabla original)
  @Column({ name: 'servicio_nombre' })
  servicioNombre: string;

  @Column({ name: 'servicio_descripcion', type: 'text', nullable: true })
  servicioDescripcion: string;

  @Column({
    name: 'servicio_precio_base',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  servicioPrecioBase: number | null;

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

  @OneToMany(
    () => ServicioProgramadoActividad,
    (actividad) => actividad.servicioProgramado,
  )
  actividades: ServicioProgramadoActividad[];

  @OneToMany(() => ServicioProgramadoInsumo, (insumo) => insumo.servicioProgramado)
  insumos: ServicioProgramadoInsumo[];
}
