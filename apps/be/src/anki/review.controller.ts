import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AnkiConnectService } from './anki-connect.service.js';
import {
  ReviewCardDto,
  AnswerCardDto,
  RescheduleCardDto,
  ReviewSessionDto,
} from '../dtos/review.dto.js';

@ApiTags('Review')
@Controller('anki/review')
export class ReviewController {
  constructor(private readonly anki: AnkiConnectService) {}

  @Post('start/:deck')
  @ApiOperation({ summary: 'Start a review session for a deck' })
  @ApiParam({ name: 'deck', description: 'Deck name' })
  @ApiOkResponse({ type: ReviewSessionDto })
  start(@Param('deck') deck: string) {
    return this.anki.startReview(deck);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get the current review card' })
  @ApiOkResponse({ type: ReviewCardDto })
  getCurrent() {
    return this.anki.getCurrentCard();
  }

  @Post('show-answer')
  @ApiOperation({ summary: 'Reveal the answer for the current card' })
  showAnswer() {
    return this.anki.showAnswer();
  }

  @Post('answer')
  @ApiOperation({ summary: 'Answer the current card' })
  answer(@Body() body: AnswerCardDto) {
    return this.anki.answerCard(body.ease);
  }

  @Post('reschedule')
  @ApiOperation({ summary: 'Reschedule a card with a custom interval' })
  reschedule(@Body() body: RescheduleCardDto) {
    return this.anki.rescheduleCard(body.cardId, body.days);
  }
}
