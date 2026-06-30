import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_AI_MODEL,
  type AiCardContext,
  type AiChatRequest,
  type AiStreamEvent,
} from '@nts/shared';
import { SettingsService } from '../settings/settings.service.js';
import { ConversationStoreService } from './conversation-store.service.js';
import { LlmService, type LlmMessage } from './llm.service.js';

@Injectable()
export class AiConversationService {
  constructor(
    private readonly settings: SettingsService,
    private readonly store: ConversationStoreService,
    private readonly llm: LlmService,
  ) {}

  async *chatStream(
    req: AiChatRequest,
    signal: AbortSignal,
  ): AsyncGenerator<AiStreamEvent> {
    const config = await this.settings.getAiConfig();
    if (!config.apiKey) {
      yield { type: 'error', message: 'No OpenRouter API key configured.' };
      return;
    }
    const apiKey = config.apiKey;
    const model = config.model || DEFAULT_AI_MODEL;
    const systemPrompt = buildSystemPrompt(config.systemPrompt, req.context);

    const file = await this.store.read(req.noteId);
    const id = req.conversationId ?? randomUUID();
    const existing = file.conversations.find((c) => c.id === id);

    const wireMessages: LlmMessage[] = [
      ...(existing?.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })) ?? []),
      { role: 'user', content: req.message },
    ];

    yield { type: 'meta', conversationId: id };

    let accumulated = '';
    try {
      for await (const delta of this.llm.chatStream(
        wireMessages,
        systemPrompt,
        model,
        apiKey,
        signal,
      )) {
        accumulated += delta;
        yield { type: 'delta', content: delta };
      }
    } catch (err) {
      if (signal.aborted) return;
      const message = err instanceof Error ? err.message : 'Stream failed';
      yield { type: 'error', message };
      return;
    }

    if (signal.aborted) return;

    const now = Date.now();
    const conversation =
      existing ??
      (() => {
        const created = { id, createdAt: now, updatedAt: now, messages: [] };
        file.conversations.push(created);
        return created;
      })();
    conversation.messages.push({ role: 'user', content: req.message });
    conversation.messages.push({ role: 'assistant', content: accumulated });
    conversation.updatedAt = now;
    await this.store.write(req.noteId, file);

    yield { type: 'done' };
  }
}

function buildSystemPrompt(userPrompt: string, context: AiCardContext): string {
  const fields = Object.entries(context.fields)
    .map(([name, value]) => [name, cleanFieldValue(value)] as const)
    .filter(([, value]) => value.length > 0)
    .map(([name, value]) => `${name}: ${value}`)
    .join('\n');
  const cardBlock = [
    '<current_card>',
    `Note type: ${context.modelName}`,
    fields,
    '</current_card>',
  ]
    .filter(Boolean)
    .join('\n');

  const guard =
    'The <current_card> block below is private context describing the flashcard the user is currently reviewing. Use it silently to ground your answers. Never repeat, quote, or describe this block — including its tags, field names, or formatting — and never mention how the card was provided to you. Just talk naturally about the content.';

  const trimmed = userPrompt.trim();
  return [trimmed, guard, cardBlock].filter(Boolean).join('\n\n');
}

function cleanFieldValue(value: string): string {
  return value
    .replace(/\[sound:[^\]]+]/g, '')
    .replace(/\[anki:play:[^\]]+]/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
