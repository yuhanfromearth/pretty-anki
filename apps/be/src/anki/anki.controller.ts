import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AnkiConnectService } from './anki-connect.service.js';
import { DeckStatsDto } from '../dtos/deck-stats.dto.js';
import { StreakDto } from '../dtos/streak.dto.js';
import { ReviewPaceDto } from '../dtos/review-pace.dto.js';

@ApiTags('Anki')
@Controller('anki')
export class AnkiController {
  constructor(private readonly anki: AnkiConnectService) {}

  @Get('decks')
  @ApiOperation({ summary: 'List all decks' })
  @ApiOkResponse({ description: 'Array of deck names', type: [String] })
  getDecks() {
    return this.anki.getDecks();
  }

  @Get('deck-stats')
  @ApiOperation({ summary: 'Get per-deck statistics' })
  @ApiOkResponse({ type: DeckStatsDto })
  getDeckStats() {
    return this.anki.getDeckStats();
  }

  @Get('streak')
  @ApiOperation({ summary: 'Get current review streak' })
  @ApiOkResponse({ type: StreakDto })
  getStreak() {
    return this.anki.getStreak();
  }

  @Get('review-pace')
  @ApiOperation({ summary: 'Get review pace and total due count' })
  @ApiOkResponse({ type: ReviewPaceDto })
  getReviewPace() {
    return this.anki.getReviewPace();
  }
}
