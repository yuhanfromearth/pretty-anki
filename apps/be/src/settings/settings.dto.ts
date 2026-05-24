import { UserSettingsSchema } from '@nts/dtos';
import { createZodDto } from 'nestjs-zod';

export class UserSettingsDto extends createZodDto(UserSettingsSchema) {}
