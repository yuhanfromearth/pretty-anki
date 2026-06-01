import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { FieldOpSchema, type FieldOp } from '@nts/shared';
import { TemplatesService } from './templates.service.js';
import {
  CreateTemplateDto,
  TemplateDetailDto,
  TemplateSampleListDto,
  TemplateSummaryListDto,
  UpdateLayoutDto,
} from '../dtos/template.dto.js';

@ApiTags('Templates')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List all note types as Templates' })
  @ApiOkResponse({ type: TemplateSummaryListDto })
  list() {
    return this.templates.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a note type and seed its layout' })
  @ApiCreatedResponse({ type: TemplateDetailDto })
  create(@Body() body: CreateTemplateDto) {
    return this.templates.create(body);
  }

  @Get(':modelId')
  @ApiOperation({ summary: 'Get a Template: live fields + saved layout' })
  @ApiParam({ name: 'modelId', description: 'Anki note type id' })
  @ApiOkResponse({ type: TemplateDetailDto })
  detail(@Param('modelId', ParseIntPipe) modelId: number) {
    return this.templates.detail(modelId);
  }

  @Put(':modelId/fields')
  @ApiOperation({ summary: 'Add, rename, remove, or reposition a field' })
  @ApiParam({ name: 'modelId', description: 'Anki note type id' })
  @ApiBody({
    description:
      'Discriminated by `op`: add | rename | remove (needs confirm:true) | reposition',
  })
  @ApiOkResponse({ type: TemplateDetailDto })
  fields(
    @Param('modelId', ParseIntPipe) modelId: number,
    @Body(new ZodValidationPipe(FieldOpSchema)) body: FieldOp,
  ) {
    return this.templates.applyFieldOp(modelId, body);
  }

  @Put(':modelId/layout')
  @ApiOperation({ summary: 'Persist the layout, custom CSS, and sample note' })
  @ApiParam({ name: 'modelId', description: 'Anki note type id' })
  @ApiOkResponse({ type: TemplateDetailDto })
  layout(
    @Param('modelId', ParseIntPipe) modelId: number,
    @Body() body: UpdateLayoutDto,
  ) {
    return this.templates.updateLayout(modelId, body);
  }

  @Post(':modelId/reset')
  @ApiOperation({ summary: 'Clear the app-native layout (revert to fallback)' })
  @ApiParam({ name: 'modelId', description: 'Anki note type id' })
  @ApiOkResponse({ type: TemplateDetailDto })
  reset(@Param('modelId', ParseIntPipe) modelId: number) {
    return this.templates.resetLayout(modelId);
  }

  @Get(':modelId/samples')
  @ApiOperation({ summary: 'Real notes of this type for the preview sampler' })
  @ApiParam({ name: 'modelId', description: 'Anki note type id' })
  @ApiOkResponse({ type: TemplateSampleListDto })
  samples(@Param('modelId', ParseIntPipe) modelId: number) {
    return this.templates.samples(modelId);
  }
}
