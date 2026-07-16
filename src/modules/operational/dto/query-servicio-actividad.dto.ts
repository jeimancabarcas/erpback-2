import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryServicioActividadDto extends PaginationDto {
  @IsOptional()
  @IsUUID('all', { message: 'El ID del servicio debe ser un UUID válido' })
  servicioId?: string;
}
