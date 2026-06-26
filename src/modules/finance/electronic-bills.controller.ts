import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ElectronicBillsService } from './electronic-bills.service';
import { CreateElectronicBillDto } from './dto/create-electronic-bill.dto';
import { QueryElectronicBillsDto } from './dto/query-electronic-bills.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class ElectronicBillsController {
  constructor(
    private readonly electronicBillsService: ElectronicBillsService,
  ) {}

  @Post('electronic-bills')
  create(@Body(ValidationPipe) dto: CreateElectronicBillDto) {
    return this.electronicBillsService.create(dto);
  }

  @Get('electronic-bills')
  findAll(@Query(ValidationPipe) query: QueryElectronicBillsDto) {
    return this.electronicBillsService.findAll(query);
  }
}
