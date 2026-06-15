import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service.js';
import { UserSettingsDto, UserSettingsUpdateDto } from './settings.dto.js';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user settings' })
  @ApiOkResponse({ type: UserSettingsDto })
  get() {
    return this.settings.get();
  }

  @Put()
  @ApiOperation({ summary: 'Update user settings' })
  @ApiOkResponse({ type: UserSettingsDto })
  update(@Body() body: UserSettingsUpdateDto) {
    return this.settings.update(body);
  }
}
