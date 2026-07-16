import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Servicio } from './servicio.entity';
import { Actividad } from './actividad.entity';

@Entity('servicio_actividades')
export class ServicioActividad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Servicio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'servicio_id' })
  servicio: Servicio;

  @ManyToOne(() => Actividad, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actividad_id' })
  actividad: Actividad;
}
