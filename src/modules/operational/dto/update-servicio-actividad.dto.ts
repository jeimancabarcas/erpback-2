import { PartialType } from '@nestjs/mapped-types';
import { CreateServicioActividadDto } from './create-servicio-actividad.dto';

export class UpdateServicioActividadDto extends PartialType(CreateServicioActividadDto) {}
