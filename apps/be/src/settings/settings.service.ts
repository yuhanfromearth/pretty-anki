import { Injectable } from '@nestjs/common';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import type { UserSettings, UserSettingsUpdate } from '@nts/shared';

const SETTINGS_DIR = join(homedir(), '.pretty-anki');
const SETTINGS_FILE = join(SETTINGS_DIR, 'settings.json');
// settings.json now holds the OpenRouter API key, so keep it owner-only.
const SECRET_FILE_MODE = 0o600;

// On-disk shape. Wider than the public UserSettings: it holds the raw API key,
// which is never returned to the browser (GET exposes only `hasApiKey`).
interface StoredSettings {
  displayName: string | null;
  avatar: string | null;
  cardTilt?: boolean;
  soundEffects?: boolean;
  dailyProgress?: boolean;
  cardTypeBadge?: boolean;
  aiSystemPrompt: string | null;
  aiModel: string | null;
  aiQuickPrompts?: string[];
  openRouterApiKey: string | null;
}

const DEFAULT_STORED: StoredSettings = {
  displayName: null,
  avatar: null,
  cardTilt: true,
  soundEffects: true,
  dailyProgress: true,
  cardTypeBadge: true,
  aiSystemPrompt: null,
  aiModel: null,
  aiQuickPrompts: [
    'Give me 3 often used example sentences',
    'Build sentences in formal and casual speech',
    'Conjugate the word in present tense',
  ],
  openRouterApiKey: null,
};

@Injectable()
export class SettingsService {
  private async read(): Promise<StoredSettings> {
    try {
      const raw = await readFile(SETTINGS_FILE, 'utf-8');
      return { ...DEFAULT_STORED, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_STORED };
    }
  }

  private async write(settings: StoredSettings): Promise<void> {
    await mkdir(SETTINGS_DIR, { recursive: true });
    await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    await chmod(SETTINGS_FILE, SECRET_FILE_MODE);
  }

  private toPublic(stored: StoredSettings): UserSettings {
    return {
      displayName: stored.displayName,
      avatar: stored.avatar,
      cardTilt: stored.cardTilt,
      soundEffects: stored.soundEffects,
      dailyProgress: stored.dailyProgress,
      cardTypeBadge: stored.cardTypeBadge,
      aiSystemPrompt: stored.aiSystemPrompt,
      aiModel: stored.aiModel,
      aiQuickPrompts: stored.aiQuickPrompts ?? [],
      hasApiKey: !!stored.openRouterApiKey,
    };
  }

  async get(): Promise<UserSettings> {
    return this.toPublic(await this.read());
  }

  async update(update: UserSettingsUpdate): Promise<UserSettings> {
    const current = await this.read();

    // The key is write-only: a non-empty `apiKey` replaces it, `removeApiKey`
    // clears it, and otherwise the stored key is preserved untouched.
    let openRouterApiKey = current.openRouterApiKey;
    if (update.removeApiKey) {
      openRouterApiKey = null;
    } else if (update.apiKey && update.apiKey.trim()) {
      openRouterApiKey = update.apiKey.trim();
    }

    const next: StoredSettings = {
      displayName: update.displayName,
      avatar: update.avatar,
      cardTilt: update.cardTilt,
      soundEffects: update.soundEffects,
      dailyProgress: update.dailyProgress,
      cardTypeBadge: update.cardTypeBadge,
      aiSystemPrompt: update.aiSystemPrompt,
      aiModel: update.aiModel,
      // Drop blank rows the editor may submit.
      aiQuickPrompts: update.aiQuickPrompts
        .map((p) => p.trim())
        .filter(Boolean),
      openRouterApiKey,
    };
    await this.write(next);
    return this.toPublic(next);
  }

  /** The active OpenRouter key, or null when none is configured. */
  async getApiKey(): Promise<string | null> {
    return (await this.read()).openRouterApiKey;
  }

  /** Everything the teacher chat needs, from a single read. `model` is null
   *  when unset (caller falls back to the default); `systemPrompt` is the
   *  user-authored prompt, empty string when unset. */
  async getAiConfig(): Promise<{
    apiKey: string | null;
    model: string | null;
    systemPrompt: string;
  }> {
    const s = await this.read();
    return {
      apiKey: s.openRouterApiKey,
      model: s.aiModel,
      systemPrompt: s.aiSystemPrompt ?? '',
    };
  }
}
