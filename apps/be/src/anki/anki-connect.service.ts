import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AnkiConnectService {
  private readonly url: string;

  constructor(configService: ConfigService) {
    this.url = configService.get<string>('ANKI_CONNECT_URL', 'http://localhost:8765');
  }

  async invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(this.url, {
      method: 'POST',
      body: JSON.stringify({ action, version: 6, params }),
    });

    const json = (await res.json()) as { result: T; error: string | null };

    if (json.error) {
      throw new Error(`AnkiConnect ${action}: ${json.error}`);
    }

    return json.result;
  }

  async getDecks(): Promise<string[]> {
    return this.invoke<string[]>('deckNames');
  }
}
