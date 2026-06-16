import {
  Body,
  Controller,
  Delete,
  Get,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type {
  AiConversation,
  AiConversationList,
  AiStreamEvent,
} from '@nts/shared';
import { AiConversationService } from './ai-conversation.service.js';
import { ConversationStoreService } from './conversation-store.service.js';
import {
  AiChatRequestDto,
  AiConversationDto,
  AiConversationListDto,
} from './ai.dto.js';

@ApiTags('AI Teacher')
@Controller('ai')
export class AiController {
  constructor(
    private readonly conversation: AiConversationService,
    private readonly store: ConversationStoreService,
  ) {}

  @Post('chat')
  @ApiOperation({
    summary:
      'Stream a teacher reply (SSE). Model, system prompt and API key are read from settings.',
  })
  @ApiProduces('text/event-stream')
  async chat(
    @Body() body: AiChatRequestDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    const write = (event: AiStreamEvent) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    try {
      for await (const evt of this.conversation.chatStream(
        body,
        controller.signal,
      )) {
        if (controller.signal.aborted) break;
        write(evt);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const message = err instanceof Error ? err.message : 'Stream failed';
        write({ type: 'error', message });
      }
    } finally {
      res.end();
    }
  }

  @Get('conversations')
  @ApiOperation({ summary: "List a note's teacher conversations" })
  @ApiQuery({ name: 'noteId', type: Number })
  @ApiOkResponse({ type: AiConversationListDto })
  async list(
    @Query('noteId', ParseIntPipe) noteId: number,
  ): Promise<AiConversationList> {
    return { conversations: await this.store.list(noteId) };
  }

  @Get('conversation')
  @ApiOperation({ summary: 'Get a single conversation with its full messages' })
  @ApiQuery({ name: 'noteId', type: Number })
  @ApiQuery({ name: 'id', type: String })
  @ApiOkResponse({ type: AiConversationDto })
  async get(
    @Query('noteId', ParseIntPipe) noteId: number,
    @Query('id') id: string,
  ): Promise<AiConversation> {
    return this.store.getOne(noteId, id);
  }

  @Delete('conversation')
  @ApiOperation({
    summary:
      "Delete a single conversation, returning the note's remaining list",
  })
  @ApiQuery({ name: 'noteId', type: Number })
  @ApiQuery({ name: 'id', type: String })
  @ApiOkResponse({ type: AiConversationListDto })
  async remove(
    @Query('noteId', ParseIntPipe) noteId: number,
    @Query('id') id: string,
  ): Promise<AiConversationList> {
    await this.store.deleteOne(noteId, id);
    return { conversations: await this.store.list(noteId) };
  }

  @Delete('conversations')
  @ApiOperation({ summary: "Delete all of a note's teacher conversations" })
  @ApiQuery({ name: 'noteId', type: Number })
  @ApiOkResponse({ type: AiConversationListDto })
  async removeAll(
    @Query('noteId', ParseIntPipe) noteId: number,
  ): Promise<AiConversationList> {
    await this.store.deleteAll(noteId);
    return { conversations: [] };
  }
}
