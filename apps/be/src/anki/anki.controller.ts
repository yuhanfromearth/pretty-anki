import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AnkiConnectService } from './anki-connect.service.js';

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
}
