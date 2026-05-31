import { AddNoteSchema } from '@nts/shared';
import { createZodDto } from 'nestjs-zod';

export class AddNoteDto extends createZodDto(AddNoteSchema) {}
