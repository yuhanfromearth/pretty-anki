import { StreakSchema } from '@nts/dtos';
import { createZodDto } from 'nestjs-zod';

export class StreakDto extends createZodDto(StreakSchema) {}
