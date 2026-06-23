import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PaymentMethodsService } from '../services/payment-methods.service';
import { QueryPaymentMethodDto } from '../dto/query-payment-method.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('settings/payment-methods')
@UseGuards(JwtAuthGuard)
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  findAll(@Query() queryDto: QueryPaymentMethodDto) {
    return this.paymentMethodsService.findAll(queryDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentMethodsService.findOne(id);
  }
}
