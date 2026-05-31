import { DeckStatsSchema } from '@nts/shared';
import { createZodDto } from 'nestjs-zod';

export class DeckStatsDto extends createZodDto(DeckStatsSchema) {}
