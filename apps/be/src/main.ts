import { json } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(json({ limit: '10mb' }));
  await app.listen(process.env.PORT ?? 8080);
}
await bootstrap();
