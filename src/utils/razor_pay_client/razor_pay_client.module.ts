import { Global, Module } from '@nestjs/common';
import { RazorPayClientService } from './razor_pay_client.service';

@Global()
@Module({
  providers: [RazorPayClientService],
  exports: [RazorPayClientService],
})
export class RazorPayClientModule {}
