import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ServicioProgramado } from './servicio-programado.entity';

@Entity('servicio_programado_insumos')
export class ServicioProgramadoInsumo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ServicioProgramado, (sp) => sp.insumos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'servicio_programado_id' })
  servicioProgramado: ServicioProgramado;

  // Snapshot del insumo (no referencia la tabla original)
  @Column({ name: 'insumo_nombre' })
  insumoNombre: string;

  @Column({ name: 'unidad_medida', nullable: true })
  unidadMedida: string;

  @Column({ type: 'float' })
  cantidad: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
