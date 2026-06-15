import { Injectable, NotFoundException } from '@nestjs/common';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type {
  AiConversation,
  AiConversationFile,
  AiConversationSummary,
} from '@nts/shared';

const STORE_DIR = join(homedir(), '.pretty-anki', 'ai-conversations');
const SNIPPET_MAX = 80;

// One JSON file per note holds all of that note's teacher conversations. Writes
// only ever touch the note under review, so a long history of studied words
// never rewrites a single shared blob.
@Injectable()
export class ConversationStoreService {
  private fileFor(noteId: number): string {
    return join(STORE_DIR, `${noteId}.json`);
  }

  async read(noteId: number): Promise<AiConversationFile> {
    try {
      const raw = await readFile(this.fileFor(noteId), 'utf-8');
      return JSON.parse(raw) as AiConversationFile;
    } catch {
      return { noteId, conversations: [] };
    }
  }

  async write(noteId: number, file: AiConversationFile): Promise<void> {
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(
      this.fileFor(noteId),
      JSON.stringify(file, null, 2),
      'utf-8',
    );
  }

  // Switcher entries, most-recently-updated first, labelled by the first user
  // message since conversations have no titles.
  async list(noteId: number): Promise<AiConversationSummary[]> {
    const file = await this.read(noteId);
    return file.conversations
      .map((c) => ({
        id: c.id,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        snippet: snippetOf(c),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getOne(noteId: number, id: string): Promise<AiConversation> {
    const file = await this.read(noteId);
    const conversation = file.conversations.find((c) => c.id === id);
    if (!conversation) {
      throw new NotFoundException(`Conversation '${id}' not found`);
    }
    return conversation;
  }
}

function snippetOf(conversation: AiConversation): string {
  const firstUser = conversation.messages.find((m) => m.role === 'user');
  const text = (firstUser?.content ?? '').replace(/\s+/g, ' ').trim();
  return text.length > SNIPPET_MAX ? `${text.slice(0, SNIPPET_MAX)}…` : text;
}
