import { Controller, Get } from '@nestjs/common';
import { CronService } from './cron.service';

@Controller('cron')
export class CronController {
    constructor(private readonly cronService: CronService) { }

    @Get('test-25th')
    async test25thOfMonth() {
        return await this.cronService.handle25thOfMonth();
    }

    @Get('test-27th')
    async test27thOfMonth() {
        return await this.cronService.handle27thOfMonth();
    }

    @Get('test-28th')
    async test28thOfMonth() {
        return await this.cronService.handle28thOfMonth();
    }
} 