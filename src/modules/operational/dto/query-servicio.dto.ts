import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryServicioDto extends PaginationDto {
  @IsOptional()
  @IsString()
  nombre?: string;
}
