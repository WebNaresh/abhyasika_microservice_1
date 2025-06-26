import { Global, Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule { }
