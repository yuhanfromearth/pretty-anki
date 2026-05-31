import { UpdateNoteFieldsSchema } from '@nts/dtos';
import { createZodDto } from 'nestjs-zod';

export class UpdateNoteFieldsDto extends createZodDto(UpdateNoteFieldsSchema) {}
