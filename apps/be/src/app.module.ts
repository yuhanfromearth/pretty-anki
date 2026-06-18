import { Module } from '@nestjs/common';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AnkiController } from './anki/anki.controller.js';
import { ReviewController } from './anki/review.controller.js';
import { AnkiConnectService } from './anki/anki-connect.service.js';
import { SettingsController } from './settings/settings.controller.js';
import { SettingsService } from './settings/settings.service.js';
import { ModelsController } from './models/models.controller.js';
import { ModelsService } from './models/models.service.js';
import { TemplatesController } from './templates/templates.controller.js';
import { TemplatesService } from './templates/templates.service.js';
import { AiController } from './ai/ai.controller.js';
import { AiConversationService } from './ai/ai-conversation.service.js';
import { ConversationStoreService } from './ai/conversation-store.service.js';
import { LlmService } from './ai/llm.service.js';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { ServeStaticModule } from '@nestjs/serve-static';

const clientRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'ui',
  'dist',
  'client',
);

@Module({
  imports: [
    ConfigModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: clientRoot,
    }),
  ],
  controllers: [
    AppController,
    AnkiController,
    ReviewController,
    SettingsController,
    TemplatesController,
    AiController,
    ModelsController,
  ],
  providers: [
    AppService,
    AnkiConnectService,
    SettingsService,
    ModelsService,
    TemplatesService,
    AiConversationService,
    ConversationStoreService,
    LlmService,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
