import { DeckStatsSchema } from '@nts/dtos';
import { createZodDto } from 'nestjs-zod';

export class DeckStatsDto extends createZodDto(DeckStatsSchema) {}
