import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Actividad } from './entities/actividad.entity';
import { Insumo } from './entities/insumo.entity';
import { Servicio } from './entities/servicio.entity';
import { ServicioActividad } from './entities/servicio-actividad.entity';
import { ServicioProgramado } from './entities/servicio-programado.entity';
import { ServicioProgramadoInsumo } from './entities/servicio-programado-insumo.entity';
import { Customer } from '../customers/entities/customer.entity';
import { OperationalService } from './operational.service';
import { OperationalController } from './operational.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Actividad,
      Insumo,
      Servicio,
      ServicioActividad,
      ServicioProgramado,
      ServicioProgramadoInsumo,
      Customer,
    ]),
  ],
  controllers: [OperationalController],
  providers: [OperationalService],
})
export class OperationalModule {}
