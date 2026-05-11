import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}
  
  @Get('stats/financial')
  getFinancialStats() {
    return this.salesService.getFinancialStats();
  }

  @Post('invoices')
  create(@Body() createDto: CreateInvoiceDto) {
    return this.salesService.create(createDto);
  }

  @Get('invoices')
  findAll(@Query() queryDto: QueryInvoicesDto) {
    return this.salesService.findAll(queryDto);
  }

  @Get('invoices/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.findOne(id);
  }
}
