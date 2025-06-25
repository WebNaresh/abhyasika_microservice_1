import { Module } from '@nestjs/common';
import { WebjsService } from './webjs.service';
import { WebjsController } from './webjs.controller';
import { DatabaseModule } from '../utils/database/database.module';
import { S3Module } from '../utils/s3/s3.module';

@Module({
  imports: [DatabaseModule, S3Module],
  controllers: [WebjsController],
  providers: [WebjsService],
  exports: [WebjsService],
})
export class WebjsModule { }
