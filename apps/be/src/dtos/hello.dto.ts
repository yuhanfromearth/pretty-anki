import { HelloSchema } from '@nts/shared';
import { createZodDto } from 'nestjs-zod';

export class HelloDto extends createZodDto(HelloSchema) {}
