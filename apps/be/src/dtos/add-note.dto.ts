import { AddNoteSchema } from '@nts/dtos';
import { createZodDto } from 'nestjs-zod';

export class AddNoteDto extends createZodDto(AddNoteSchema) {}
