import { HelloSchema } from '@nts/dtos';
import { createZodDto } from 'nestjs-zod';

export class HelloDto extends createZodDto(HelloSchema) {}
