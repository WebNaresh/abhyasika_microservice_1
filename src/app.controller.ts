import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('favicon.ico')
  getFavicon(@Res() res: Response): void {
    // Return a simple 1x1 transparent PNG as favicon
    const favicon = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    res.set({
      'Content-Type': 'image/x-icon',
      'Content-Length': favicon.length,
      'Cache-Control': 'public, max-age=86400', // Cache for 1 day
    });
    res.send(favicon);
  }
}
