import { Search, Plus, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import type { Note } from '@nts/dtos';
import { fieldToPlainText, hasCJK } from './manage-media';

interface NoteListProps {
  notes: Note[];
  selectedNoteId: number | null;
  /** Note id to auto-scroll into view (e.g. deep-linked from the review
   *  screen). Only this row scrolls — manual selections never auto-scroll. */
  scrollToNoteId: number | null;
  addActive: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (note: Note) => void;
  onAdd: () => void;
  isFetching: boolean;
  truncated: boolean;
}

export function NoteList({
  notes,
  selectedNoteId,
  scrollToNoteId,
  addActive,
  search,
  onSearchChange,
  onSelect,
  onAdd,
  isFetching,
  truncated,
}: NoteListProps) {
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-ink-300" />
          )}
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search cards…"
            className="h-9 w-full rounded-xl border border-milk-300/70 bg-milk-50/70 pl-9 pr-9 text-sm text-ink-900 placeholder:text-ink-300 outline-none transition-colors focus:border-mint-400 focus:bg-milk-50"
          />
        </div>
        <button
          type="button"
          onClick={onAdd}
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors ${
            addActive
              ? 'bg-mint-500 text-white dark:text-cocoa-950'
              : 'border border-milk-300/70 bg-milk-50/70 text-ink-700 hover:border-mint-400 hover:text-mint-700'
          }`}
        >
          <Plus className="size-4" />
          Add
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
            <p className="text-sm font-medium text-ink-500">No cards found</p>
            <p className="text-xs text-ink-300">
              {search.trim()
                ? 'Try a different search.'
                : 'Add your first card to this deck.'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {notes.map((note) => (
              <NoteRow
                key={note.noteId}
                note={note}
                selected={note.noteId === selectedNoteId}
                autoScroll={note.noteId === scrollToNoteId}
                onSelect={() => onSelect(note)}
              />
            ))}
            {truncated && (
              <li className="px-3 py-3 text-center text-[11px] text-ink-300">
                Showing the first 500 matches — refine your search to narrow
                down.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function NoteRow({
  note,
  selected,
  autoScroll,
  onSelect,
}: {
  note: Note;
  selected: boolean;
  autoScroll: boolean;
  onSelect: () => void;
}) {
  const values = Object.values(note.fields);
  const primary = fieldToPlainText(values[0] ?? '') || '(empty)';
  const secondary = fieldToPlainText(values[1] ?? '');

  // Scroll into view only for a deep-linked row (arriving from the review
  // screen or a pasted URL). Manual selections never trigger this.
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoScroll) ref.current?.scrollIntoView({ block: 'start' });
  }, [autoScroll]);

  return (
    <li>
      <motion.button
        ref={ref}
        type="button"
        onClick={onSelect}
        whileTap={{ scale: 0.99 }}
        className={`flex w-full items-baseline gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
          selected
            ? 'bg-mint-500/15 ring-1 ring-inset ring-mint-500/40'
            : 'hover:bg-milk-200/70'
        }`}
      >
        <span
          className={`min-w-0 flex-1 truncate text-sm font-medium text-ink-900 ${
            hasCJK(primary) ? 'font-korean' : ''
          }`}
        >
          {primary}
        </span>
        {secondary && (
          <span
            className={`max-w-[45%] shrink-0 truncate text-xs text-ink-400 ${
              hasCJK(secondary) ? 'font-korean' : 'font-mono'
            }`}
          >
            {secondary}
          </span>
        )}
      </motion.button>
    </li>
  );
}
