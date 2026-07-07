import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersCreditService } from './customers-credit.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { CustomerCreditDto } from './dto/customer-credit.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { PdfGenerationService } from '../pdf-generation/pdf-generation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly customersCreditService: CustomersCreditService,
    private readonly pdfGenerationService: PdfGenerationService,
  ) {}

  @Post()
  create(@Body() createDto: CreateCustomerDto) {
    return this.customersService.create(createDto);
  }

  @Get()
  findAll(@Query() queryDto: QueryCustomersDto) {
    return this.customersService.findAll(queryDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(id);
  }

  @Get(':id/stats')
  getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.getStats(id);
  }

  // === Credit Portfolio Endpoints ===

  @Get(':id/credit')
  getCreditPortfolio(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersCreditService.getCreditPortfolio(id);
  }

  @Patch(':id/credit')
  setCreditLimit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomerCreditDto,
  ) {
    return this.customersCreditService.setCreditLimit(id, dto);
  }

  @Post(':id/credit/payment')
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.customersCreditService.recordPayment(id, dto);
  }

  @Get(':id/credit/payments')
  getPaymentHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.customersCreditService.getPaymentHistory(
      id,
      invoiceId,
      page,
      limit,
    );
  }

  @Get(':id/payments/:paymentId/receipt')
  getPaymentReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.customersCreditService.getPaymentReceipt(id, paymentId);
  }

  @Get(':id/payments/:paymentId/receipt/pdf')
  async getPaymentReceiptPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    const receipt = await this.customersCreditService.getPaymentReceipt(
      id,
      paymentId,
    );
    const pdf =
      await this.pdfGenerationService.generatePaymentReceiptPdf(receipt);
    return { pdf };
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.remove(id);
  }
}
