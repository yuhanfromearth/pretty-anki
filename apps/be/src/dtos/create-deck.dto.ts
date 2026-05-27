import { CreateDeckSchema } from '@nts/dtos';
import { createZodDto } from 'nestjs-zod';

export class CreateDeckDto extends createZodDto(CreateDeckSchema) {}
