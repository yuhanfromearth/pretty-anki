import { Module } from '@nestjs/common';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AnkiController } from './anki/anki.controller.js';
import { AnkiConnectService } from './anki/anki-connect.service.js';
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
  controllers: [AppController, AnkiController],
  providers: [
    AppService,
    AnkiConnectService,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
