import type { NoteList, NoteModelList, NoteFields, AddNote } from '@nts/shared';

async function readError(r: Response): Promise<string> {
  try {
    const body = (await r.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (body.message) return body.message;
  } catch {
    /* fall through */
  }
  return `Request failed (${r.status})`;
}

export async function fetchNotes(
  deckName: string,
  search: string
): Promise<NoteList> {
  const params = search.trim() ? `?search=${encodeURIComponent(search)}` : '';
  const r = await fetch(
    `/api/anki/decks/${encodeURIComponent(deckName)}/notes${params}`
  );
  if (!r.ok) throw new Error(await readError(r));
  return r.json() as Promise<NoteList>;
}

export async function fetchModels(): Promise<NoteModelList> {
  const r = await fetch('/api/anki/models');
  if (!r.ok) throw new Error(await readError(r));
  return r.json() as Promise<NoteModelList>;
}

export async function addNote(body: AddNote): Promise<{ noteId: number }> {
  const r = await fetch('/api/anki/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json() as Promise<{ noteId: number }>;
}

export async function updateNote(
  noteId: number,
  fields: NoteFields
): Promise<void> {
  const r = await fetch(`/api/anki/notes/${noteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error(await readError(r));
}

export async function deleteNote(noteId: number): Promise<void> {
  const r = await fetch(`/api/anki/notes/${noteId}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await readError(r));
}

/** Uploads a file into the Anki collection media folder, returning the final
 *  filename Anki assigned (may be renamed to avoid collisions). */
export async function uploadMedia(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file, file.name);
  const r = await fetch('/api/anki/media', { method: 'POST', body: form });
  if (!r.ok) throw new Error(await readError(r));
  const body = (await r.json()) as { filename: string };
  return body.filename;
}

export const notesKey = (deckName: string, search: string) =>
  ['notes', deckName, search.trim()] as const;
