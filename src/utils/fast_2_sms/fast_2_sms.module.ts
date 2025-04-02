import { Global, Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { Fast2SmsService } from './fast_2_sms.service';

@Global()
@Module({
  imports: [BillingModule],
  providers: [Fast2SmsService],
  exports: [Fast2SmsService],
})
export class Fast2SmsModule { }
