import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FactusHttpAuthAdapter } from './adapters/factus-http-auth.adapter';
import { FactusHttpInvoicingAdapter } from './adapters/factus-http-invoicing.adapter';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'IFactusAuthGateway',
      useClass: FactusHttpAuthAdapter,
    },
    {
      provide: 'IFactusInvoicingGateway',
      useClass: FactusHttpInvoicingAdapter,
    },
  ],
  exports: ['IFactusAuthGateway', 'IFactusInvoicingGateway'],
})
export class FactusModule {}
