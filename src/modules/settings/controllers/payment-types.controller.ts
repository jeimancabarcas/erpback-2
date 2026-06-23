import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PaymentTypesService } from '../services/payment-types.service';
import { QueryPaymentTypeDto } from '../dto/query-payment-type.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('settings/payment-types')
@UseGuards(JwtAuthGuard)
export class PaymentTypesController {
  constructor(private readonly paymentTypesService: PaymentTypesService) {}

  @Get()
  findAll(@Query() queryDto: QueryPaymentTypeDto) {
    return this.paymentTypesService.findAll(queryDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentTypesService.findOne(id);
  }
}
