import { z } from 'zod';

// Public settings as returned by GET /settings. The raw OpenRouter API key is
// never sent to the browser — only `hasApiKey`, so the UI can enable the AI
// teacher and show a masked field without ever holding the secret.
export const UserSettingsSchema = z.object({
  displayName: z.string().nullable(),
  avatar: z.string().nullable(),
  cardTilt: z.boolean().optional(),
  soundEffects: z.boolean().optional(),
  dailyProgress: z.boolean().optional(),
  cardTypeBadge: z.boolean().optional(),
  aiSystemPrompt: z.string().nullable(),
  aiModel: z.string().nullable(),
  // One-click prompts shown above the teacher composer on a fresh chat.
  aiQuickPrompts: z.array(z.string()),
  hasApiKey: z.boolean(),
});

// PUT /settings body. The API key is write-only: omit (or send empty) to keep
// the stored key, send a value to replace it, or set removeApiKey to clear it.
export const UserSettingsUpdateSchema = z.object({
  displayName: z.string().nullable(),
  avatar: z.string().nullable(),
  cardTilt: z.boolean().optional(),
  soundEffects: z.boolean().optional(),
  dailyProgress: z.boolean().optional(),
  cardTypeBadge: z.boolean().optional(),
  aiSystemPrompt: z.string().nullable(),
  aiModel: z.string().nullable(),
  aiQuickPrompts: z.array(z.string()),
  apiKey: z.string().optional(),
  removeApiKey: z.boolean().optional(),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type UserSettingsUpdate = z.infer<typeof UserSettingsUpdateSchema>;
