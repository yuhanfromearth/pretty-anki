import { UserSettingsSchema } from '@nts/shared';
import { createZodDto } from 'nestjs-zod';

export class UserSettingsDto extends createZodDto(UserSettingsSchema) {}
