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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileValidationPipe } from './pipes/file-validation.pipe';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  create(@Body() createDto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(createDto);
  }

  @Get()
  findAll(@Query() queryDto: QueryPurchaseOrdersDto) {
    return this.purchaseOrdersService.findAll(queryDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.remove(id);
  }

  @Post(':id/complete')
  @UseInterceptors(FileInterceptor('file'))
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(FileValidationPipe) file?: Express.Multer.File,
  ) {
    return this.purchaseOrdersService.complete(id, file);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.cancel(id);
  }

  @Post(':id/support-document')
  emitSupportDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.emitSupportDocument(id);
  }

  @Get(':id/support-document/pdf')
  downloadSupportDocumentPdf(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.downloadSupportDocumentPdf(id);
  }
}
