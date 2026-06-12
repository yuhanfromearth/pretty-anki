import {
  CreateTemplateSchema,
  TemplateDefaultSampleSchema,
  TemplateDetailSchema,
  TemplateSampleListSchema,
  TemplateSummaryListSchema,
  UpdateLayoutSchema,
} from '@nts/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateTemplateDto extends createZodDto(CreateTemplateSchema) {}
export class UpdateLayoutDto extends createZodDto(UpdateLayoutSchema) {}
// FieldOpSchema is a discriminated union (not an object), which createZodDto
// can't wrap; its body is validated with a route-level ZodValidationPipe.
export class TemplateSummaryListDto extends createZodDto(
  TemplateSummaryListSchema,
) {}
export class TemplateDetailDto extends createZodDto(TemplateDetailSchema) {}
export class TemplateSampleListDto extends createZodDto(
  TemplateSampleListSchema,
) {}
export class TemplateDefaultSampleDto extends createZodDto(
  TemplateDefaultSampleSchema,
) {}
