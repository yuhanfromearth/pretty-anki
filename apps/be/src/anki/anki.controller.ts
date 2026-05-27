import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AnkiConnectService } from './anki-connect.service.js';
import { DeckStatsDto } from '../dtos/deck-stats.dto.js';
import { CreateDeckDto } from '../dtos/create-deck.dto.js';
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

  @Get('health')
  @ApiOperation({ summary: 'Check AnkiConnect connectivity' })
  @ApiOkResponse({ description: 'Connection status' })
  async getHealth() {
    try {
      await this.anki.invoke('version');
      return { connected: true };
    } catch {
      return { connected: false };
    }
  }

  @Get('media/:filename')
  @ApiOperation({ summary: 'Retrieve a media file from Anki collection' })
  @ApiParam({ name: 'filename', description: 'Media filename' })
  @ApiOkResponse({ description: 'Media file binary' })
  async getMedia(@Param('filename') filename: string, @Res() res: Response) {
    const buf = await this.anki.getMediaFile(filename);
    if (!buf) throw new NotFoundException('Media file not found');

    const ext = filename.split('.').pop()?.toLowerCase();
    const mime =
      ext === 'mp3'
        ? 'audio/mpeg'
        : ext === 'ogg'
          ? 'audio/ogg'
          : ext === 'wav'
            ? 'audio/wav'
            : 'application/octet-stream';

    res.set({
      'Content-Type': mime,
      'Content-Length': buf.length.toString(),
      'Cache-Control': 'public, max-age=86400',
    });
    res.send(buf);
  }

  @Post('decks')
  @ApiOperation({ summary: 'Create a new deck' })
  @ApiCreatedResponse({ description: 'Deck created, returns deck ID' })
  createDeck(@Body() body: CreateDeckDto) {
    return this.anki.createDeck(body.name);
  }

  @Delete('decks/:name')
  @ApiOperation({ summary: 'Delete a deck and all its cards' })
  @ApiParam({ name: 'name', description: 'Deck name' })
  @ApiOkResponse({ description: 'Deck deleted' })
  deleteDeck(@Param('name') name: string) {
    return this.anki.deleteDeck(name, true);
  }
}
