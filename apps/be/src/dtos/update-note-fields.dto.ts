import { UpdateNoteFieldsSchema } from '@nts/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateNoteFieldsDto extends createZodDto(UpdateNoteFieldsSchema) {}
