import {
  AiChatRequestSchema,
  AiConversationListSchema,
  AiConversationSchema,
} from '@nts/shared';
import { createZodDto } from 'nestjs-zod';

export class AiChatRequestDto extends createZodDto(AiChatRequestSchema) {}
export class AiConversationListDto extends createZodDto(
  AiConversationListSchema,
) {}
export class AiConversationDto extends createZodDto(AiConversationSchema) {}
