import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateServicioActividadDto {
  @IsUUID('all', { message: 'El ID del servicio debe ser un UUID válido' })
  @IsNotEmpty()
  servicioId: string;

  @IsUUID('all', { message: 'El ID de la actividad debe ser un UUID válido' })
  @IsNotEmpty()
  actividadId: string;
}
