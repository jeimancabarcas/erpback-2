import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tax } from './entities/tax.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { PaymentType } from './entities/payment-type.entity';
import { TaxesService } from './services/taxes.service';
import { PaymentMethodsService } from './services/payment-methods.service';
import { PaymentTypesService } from './services/payment-types.service';
import { TaxesController } from './controllers/taxes.controller';
import { PaymentMethodsController } from './controllers/payment-methods.controller';
import { PaymentTypesController } from './controllers/payment-types.controller';
import { SeedController } from './controllers/seed.controller';
import { SeedService } from './services/seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tax, PaymentMethod, PaymentType])],
  controllers: [TaxesController, PaymentMethodsController, PaymentTypesController, SeedController],
  providers: [TaxesService, PaymentMethodsService, PaymentTypesService, SeedService],
  exports: [TaxesService, PaymentMethodsService, PaymentTypesService],
})
export class SettingsModule {}
