import { Controller, Get } from '@nestjs/common';
import type { Hello } from '@nts/dtos';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('hello')
  hello(): Hello {
    return { message: this.appService.getHello() };
  }
}
