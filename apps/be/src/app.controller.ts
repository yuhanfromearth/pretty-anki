import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Hello } from '@nts/shared';
import { AppService } from './app.service.js';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('hello')
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({ description: 'Hello message' })
  hello(): Hello {
    return { message: this.appService.getHello() };
  }
}
