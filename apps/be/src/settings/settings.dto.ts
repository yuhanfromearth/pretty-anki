import { UserSettingsSchema, UserSettingsUpdateSchema } from '@nts/shared';
import { createZodDto } from 'nestjs-zod';

export class UserSettingsDto extends createZodDto(UserSettingsSchema) {}
export class UserSettingsUpdateDto extends createZodDto(
  UserSettingsUpdateSchema,
) {}
