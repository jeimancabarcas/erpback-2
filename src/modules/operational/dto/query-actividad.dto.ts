import { IsNumber, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryActividadDto extends PaginationDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsNumber({}, { message: 'El filtro de horas estimadas debe ser un número' })
  horasEstimadas?: number;
}
