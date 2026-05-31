import { CreateDeckSchema } from '@nts/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateDeckDto extends createZodDto(CreateDeckSchema) {}
