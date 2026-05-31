import { StreakSchema } from '@nts/shared';
import { createZodDto } from 'nestjs-zod';

export class StreakDto extends createZodDto(StreakSchema) {}
