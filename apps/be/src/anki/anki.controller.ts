import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiConsumes,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AnkiConnectService } from './anki-connect.service.js';
import { DeckStatsDto } from '../dtos/deck-stats.dto.js';
import { CreateDeckDto } from '../dtos/create-deck.dto.js';
import { StreakDto } from '../dtos/streak.dto.js';
import { ReviewPaceDto } from '../dtos/review-pace.dto.js';
import { AddNoteDto } from '../dtos/add-note.dto.js';
import { UpdateNoteFieldsDto } from '../dtos/update-note-fields.dto.js';
import { NoteListDto, NoteModelListDto } from '../dtos/note.dto.js';

// Minimal shape of a multer in-memory file (avoids needing @types/multer).
interface UploadedMedia {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
}

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

  @Post('media')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Store an audio/image file in the Anki collection media folder',
  })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({
    description: 'File stored, returns the final (possibly renamed) filename',
  })
  async uploadMedia(@UploadedFile() file?: UploadedMedia) {
    if (!file) throw new BadRequestException('No file uploaded');
    // busboy (under multer) decodes multipart filenames as latin1, so UTF-8
    // names like "성인.mp3" arrive mangled — re-decode them back to UTF-8.
    const originalName = Buffer.from(file.originalname, 'latin1').toString(
      'utf8',
    );
    const filename = await this.anki.storeMediaFile(
      originalName,
      file.buffer.toString('base64'),
    );
    return { filename };
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

  @Get('decks/:name/notes')
  @ApiOperation({
    summary: 'List notes in a deck, optionally filtered by text',
  })
  @ApiParam({ name: 'name', description: 'Deck name' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Free-text filter matched across all fields',
  })
  @ApiOkResponse({ type: NoteListDto })
  getNotes(@Param('name') name: string, @Query('search') search?: string) {
    return this.anki.getNotes(name, search);
  }

  @Get('models')
  @ApiOperation({ summary: 'List note types (models) and their field names' })
  @ApiOkResponse({ type: NoteModelListDto })
  getModels() {
    return this.anki.getModels();
  }

  @Post('notes')
  @ApiOperation({ summary: 'Add a new note to a deck' })
  @ApiCreatedResponse({ description: 'Note created, returns note ID' })
  async addNote(@Body() body: AddNoteDto) {
    const noteId = await this.anki.addNote(
      body.deckName,
      body.modelName,
      body.fields,
      body.tags,
    );
    return { noteId };
  }

  @Put('notes/:id')
  @ApiOperation({ summary: "Update an existing note's fields" })
  @ApiParam({ name: 'id', description: 'Note ID' })
  @ApiOkResponse({ description: 'Note updated' })
  async updateNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateNoteFieldsDto,
  ) {
    await this.anki.updateNoteFields(id, body.fields);
    return { ok: true };
  }

  @Delete('notes/:id')
  @ApiOperation({ summary: 'Delete a note and all of its cards' })
  @ApiParam({ name: 'id', description: 'Note ID' })
  @ApiOkResponse({ description: 'Note deleted' })
  async deleteNote(@Param('id', ParseIntPipe) id: number) {
    await this.anki.deleteNotes([id]);
    return { ok: true };
  }
}
