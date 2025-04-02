import { Global, Module } from '@nestjs/common';
import { BillingService } from './billing.service';

@Global()
@Module({
  controllers: [],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule { }
