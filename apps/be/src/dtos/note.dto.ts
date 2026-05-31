import { NoteListSchema, NoteModelListSchema } from '@nts/dtos';
import { createZodDto } from 'nestjs-zod';

export class NoteListDto extends createZodDto(NoteListSchema) {}

export class NoteModelListDto extends createZodDto(NoteModelListSchema) {}
