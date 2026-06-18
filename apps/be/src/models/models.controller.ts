import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseBoolPipe,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { ModelDto } from '@nts/shared';
import { ModelsService } from './models.service.js';

@ApiTags('Models')
@Controller('models')
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  @Get()
  @ApiOperation({ summary: 'Search the OpenRouter model catalog with pricing' })
  @ApiQuery({ name: 'search', required: false, description: 'id/name match' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max rows (def 20)',
  })
  @ApiQuery({ name: 'free', required: false, description: 'Free models only' })
  @ApiOkResponse({ description: 'Matching models with per-token pricing' })
  getModels(
    @Query('search') search?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('free', new ParseBoolPipe({ optional: true })) free?: boolean,
  ): Promise<ModelDto[]> {
    return this.models.getModels(search, limit, free);
  }
}
