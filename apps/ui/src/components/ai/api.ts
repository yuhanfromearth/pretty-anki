import type {
  AiCardContext,
  AiConversation,
  AiConversationList,
  AiStreamEvent,
} from '@nts/shared';
import { AiStreamEventSchema } from '@nts/shared';

export const conversationsKey = (noteId: number) =>
  ['ai', 'conversations', noteId] as const;
export const conversationKey = (noteId: number, id: string) =>
  ['ai', 'conversation', noteId, id] as const;

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json() as Promise<T>;
}

export async function fetchConversations(
  noteId: number
): Promise<AiConversationList> {
  return json(await fetch(`/api/ai/conversations?noteId=${noteId}`));
}

export async function fetchConversation(
  noteId: number,
  id: string
): Promise<AiConversation> {
  return json(
    await fetch(
      `/api/ai/conversation?noteId=${noteId}&id=${encodeURIComponent(id)}`
    )
  );
}

// Both deletes return the note's remaining conversation list, so callers can
// drop it straight into the query cache without a follow-up refetch.
export async function deleteConversation(
  noteId: number,
  id: string
): Promise<AiConversationList> {
  return json(
    await fetch(
      `/api/ai/conversation?noteId=${noteId}&id=${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    )
  );
}

export async function deleteAllConversations(
  noteId: number
): Promise<AiConversationList> {
  return json(
    await fetch(`/api/ai/conversations?noteId=${noteId}`, { method: 'DELETE' })
  );
}

export interface ChatPayload {
  noteId: number;
  conversationId?: string;
  message: string;
  context: AiCardContext;
}

// Streams teacher events from POST /api/ai/chat. Hand-rolls the minimal `data:`
// SSE parse (the backend writes one JSON event per `\n\n`-delimited block) so we
// avoid pulling in an eventsource dependency. Deltas are yielded as they land.
export async function* streamChat(
  payload: ChatPayload,
  signal: AbortSignal
): AsyncGenerator<AiStreamEvent> {
  let response: Response;
  try {
    response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (signal.aborted) return;
    yield {
      type: 'error',
      message: err instanceof Error ? err.message : 'Network error',
    };
    return;
  }

  if (!response.ok || !response.body) {
    yield { type: 'error', message: `Request failed (${response.status})` };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const data = dataLine.slice(5).trim();
        if (!data) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        const result = AiStreamEventSchema.safeParse(parsed);
        if (result.success) yield result.data;
      }
    }
  } catch (err) {
    if (signal.aborted) return;
    yield {
      type: 'error',
      message: err instanceof Error ? err.message : 'Stream failed',
    };
  } finally {
    reader.releaseLock();
  }
}
