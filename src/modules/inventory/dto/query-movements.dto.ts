import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryMovementsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsIn(['In', 'Out'])
  type?: 'In' | 'Out';

  @IsOptional()
  @IsString()
  userId?: string;
}
