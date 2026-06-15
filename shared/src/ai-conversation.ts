import { z } from 'zod';
import { NoteFieldsSchema } from './note.js';

// Fallback chat model when the user hasn't set one in settings. Also the
// placeholder shown in the settings model field.
export const DEFAULT_AI_MODEL = 'google/gemini-2.5-flash';

// A single turn in a teacher conversation. Only user/assistant text is
// persisted — the system prompt is rebuilt each turn from settings + the card.
export const AiMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export const AiConversationSchema = z.object({
  id: z.string(),
  /** Creation time, epoch milliseconds. */
  createdAt: z.number(),
  /** Last-updated time, epoch milliseconds — drives "most recent" ordering. */
  updatedAt: z.number(),
  messages: z.array(AiMessageSchema),
});

// On-disk shape of a note's conversation file (one file per note).
export const AiConversationFileSchema = z.object({
  noteId: z.number(),
  conversations: z.array(AiConversationSchema),
});

// Lightweight entry for the in-chat conversation switcher. The snippet is the
// first user message, truncated, since conversations have no titles.
export const AiConversationSummarySchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  snippet: z.string(),
});

export const AiConversationListSchema = z.object({
  conversations: z.array(AiConversationSummarySchema),
});

// The current card, as the review page already holds it. Sent with each chat
// request so the backend can append it to the system prompt without re-reading
// Anki. Fields are name → value (HTML already stripped by getCurrentCard).
export const AiCardContextSchema = z.object({
  modelName: z.string(),
  fields: NoteFieldsSchema,
});

export const AiChatRequestSchema = z.object({
  noteId: z.number(),
  // Omitted to start a fresh conversation; the server mints an id and returns
  // it on the `meta` event.
  conversationId: z.string().optional(),
  message: z.string().min(1),
  context: AiCardContextSchema,
});

// Server → client SSE events. The model, system prompt and API key all live
// server-side, so the stream carries only the conversation id and reply text.
export const AiStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('meta'), conversationId: z.string() }),
  z.object({ type: z.literal('delta'), content: z.string() }),
  z.object({ type: z.literal('done') }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

export type AiMessage = z.infer<typeof AiMessageSchema>;
export type AiConversation = z.infer<typeof AiConversationSchema>;
export type AiConversationFile = z.infer<typeof AiConversationFileSchema>;
export type AiConversationSummary = z.infer<typeof AiConversationSummarySchema>;
export type AiConversationList = z.infer<typeof AiConversationListSchema>;
export type AiCardContext = z.infer<typeof AiCardContextSchema>;
export type AiChatRequest = z.infer<typeof AiChatRequestSchema>;
export type AiStreamEvent = z.infer<typeof AiStreamEventSchema>;
