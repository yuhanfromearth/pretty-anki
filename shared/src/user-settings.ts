import { z } from 'zod';

export const UserSettingsSchema = z.object({
  displayName: z.string().nullable(),
  avatar: z.string().nullable(),
  cardTilt: z.boolean().optional(),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;
