import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ServicioProgramado } from './servicio-programado.entity';

@Entity('servicio_programado_actividades')
export class ServicioProgramadoActividad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ServicioProgramado, (sp) => sp.actividades, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'servicio_programado_id' })
  servicioProgramado: ServicioProgramado;

  @Column({ name: 'actividad_nombre' })
  actividadNombre: string;

  @Column({ name: 'actividad_descripcion', type: 'text', nullable: true })
  actividadDescripcion: string;

  @Column({
    name: 'actividad_horas_estimadas',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  actividadHorasEstimadas: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
