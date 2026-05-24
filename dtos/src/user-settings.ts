import { z } from 'zod';

export const UserSettingsSchema = z.object({
  displayName: z.string().nullable(),
  avatar: z.string().nullable(),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;
