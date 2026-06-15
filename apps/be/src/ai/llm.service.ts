import { Injectable } from '@nestjs/common';

// OpenAI-compatible message shape sent to OpenRouter.
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

// OpenRouter pre-flight-checks `max_tokens × completion_price` against the key's
// remaining credit. Without a cap it assumes the model's full output capacity,
// which can fail even tiny prompts on tight budgets — so cap to a sane reply.
const CHAT_MAX_TOKENS = 8192;

@Injectable()
export class LlmService {
  // Streams assistant text deltas from OpenRouter. No tools, no usage tracking —
  // the teacher is grounded entirely in the system prompt, so we only need the
  // content stream. Yields raw delta strings as they arrive.
  async *chatStream(
    messages: LlmMessage[],
    systemPrompt: string,
    model: string,
    apiKey: string,
    signal: AbortSignal,
  ): AsyncGenerator<string> {
    const wireMessages: LlmMessage[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: CHAT_MAX_TOKENS,
        messages: wireMessages,
      }),
      signal,
    });

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `OpenRouter chat failed: ${response.status} ${response.statusText} ${detail}`.trim(),
      );
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
          const event = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          for (const line of event.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            let chunk: {
              choices?: { delta?: { content?: string } }[];
            };
            try {
              chunk = JSON.parse(data) as typeof chunk;
            } catch {
              continue;
            }
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) yield content;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
