import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MessageModule } from '../messages/message.module';
import { DatabaseModule } from '../utils/database/database.module';
import { CronController } from './cron.controller';
import { CronService } from './cron.service';
@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    MessageModule
  ],
  providers: [CronService],
  controllers: [CronController]
})
export class CronModule { }
