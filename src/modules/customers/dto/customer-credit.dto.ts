import { IsNumber, IsOptional, Min, Max, MinLength } from 'class-validator';

export class CustomerCreditDto {
  @IsNumber({}, { message: 'creditLimit debe ser un número' })
  @Min(0, { message: 'creditLimit no puede ser negativo' })
  creditLimit: number | null;

  @IsOptional()
  @IsNumber({}, { message: 'paymentTermsDays debe ser un número' })
  @Min(1, { message: 'paymentTermsDays debe ser al menos 1' })
  @Max(365, { message: 'paymentTermsDays no puede exceder 365' })
  paymentTermsDays?: number;
}
