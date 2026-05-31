import { Injectable } from '@nestjs/common';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { UserSettings } from '@nts/shared';

const SETTINGS_DIR = join(homedir(), '.pretty-anki');
const SETTINGS_FILE = join(SETTINGS_DIR, 'settings.json');

const DEFAULT_SETTINGS: UserSettings = {
  displayName: null,
  avatar: null,
  cardTilt: true,
};

@Injectable()
export class SettingsService {
  async get(): Promise<UserSettings> {
    try {
      const raw = await readFile(SETTINGS_FILE, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async update(settings: UserSettings): Promise<UserSettings> {
    await mkdir(SETTINGS_DIR, { recursive: true });
    await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    return settings;
  }
}
