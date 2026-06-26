import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { PaymentRecord } from './entities/payment-record.entity';
import { CustomersService } from './customers.service';
import { CustomersCreditService } from './customers-credit.service';
import { CustomersController } from './customers.controller';
import { Invoice } from '../sales/entities/invoice.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, Invoice, PaymentRecord])],
  controllers: [CustomersController],
  providers: [CustomersService, CustomersCreditService],
  exports: [CustomersService, CustomersCreditService],
})
export class CustomersModule {}
