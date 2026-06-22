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
  Req,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryCategoryDto } from './dto/create-inventory-category.dto';
import { UpdateInventoryCategoryDto } from './dto/update-inventory-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // --- Category Endpoints ---

  @Post('categories')
  createCategory(@Body() createDto: CreateInventoryCategoryDto) {
    return this.inventoryService.create(createDto);
  }

  @Get('categories')
  findAllCategories(@Query() queryDto: QueryCategoriesDto) {
    return this.inventoryService.findAll(queryDto);
  }

  @Get('categories/:id')
  findOneCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findOne(id);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateInventoryCategoryDto,
  ) {
    return this.inventoryService.update(id, updateDto);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.remove(id);
  }

  @Get('movements')
  getMovements() {
    return this.inventoryService.getMovements();
  }

  @Get('stats/valuation')
  getValuation() {
    return this.inventoryService.getValuation();
  }

  // --- Product Endpoints ---

  @Post('products')
  createProduct(@Body() createDto: CreateProductDto, @Req() req: any) {
    return this.inventoryService.createProduct(createDto, req.user);
  }

  @Get('products')
  findAllProducts(@Query() queryDto: QueryProductsDto) {
    return this.inventoryService.findAllProducts(queryDto);
  }

  @Get('products/:id')
  findOneProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findOneProduct(id);
  }

  @Get('products/:id/batches')
  findProductBatches(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findProductBatches(id);
  }

  @Patch('products/:id')
  updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateProductDto,
    @Req() req: any,
  ) {
    return this.inventoryService.updateProduct(id, updateDto, req.user);
  }

  @Delete('products/:id')
  removeProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.removeProduct(id);
  }
}
