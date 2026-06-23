import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TaxesService } from '../services/taxes.service';
import { QueryTaxDto } from '../dto/query-tax.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('settings/taxes')
@UseGuards(JwtAuthGuard)
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  @Get()
  findAll(@Query() queryDto: QueryTaxDto) {
    return this.taxesService.findAll(queryDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.taxesService.findOne(id);
  }
}
