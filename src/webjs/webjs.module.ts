import { Module } from '@nestjs/common';
import { WebjsService } from './webjs.service';
import { WebjsController } from './webjs.controller';
import { DatabaseModule } from '../utils/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [WebjsController],
  providers: [WebjsService],
  exports: [WebjsService],
})
export class WebjsModule { }
