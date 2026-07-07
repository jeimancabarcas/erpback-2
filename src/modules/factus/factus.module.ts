import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FactusHttpAuthAdapter } from './adapters/factus-http-auth.adapter';
import { FactusHttpInvoicingAdapter } from './adapters/factus-http-invoicing.adapter';
import { FactusHttpQueryAdapter } from './adapters/factus-http-query.adapter';

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
    {
      provide: 'IFactusQueryGateway',
      useClass: FactusHttpQueryAdapter,
    },
  ],
  exports: [
    'IFactusAuthGateway',
    'IFactusInvoicingGateway',
    'IFactusQueryGateway',
  ],
})
export class FactusModule {}
