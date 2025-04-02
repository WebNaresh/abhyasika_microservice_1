import { Global, Module } from '@nestjs/common';
import { CryptoClientService } from './crypto_client.service';
@Global()
@Module({
  providers: [CryptoClientService],
  exports: [CryptoClientService],
})
export class CryptoClientModule {}
