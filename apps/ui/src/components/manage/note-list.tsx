import {
  Search,
  Plus,
  Loader2,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Note } from '@nts/shared';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover';
import { fieldToPlainText, hasCJK } from './manage-media';

type SortKey =
  | 'created-desc'
  | 'created-asc'
  | 'modified-desc'
  | 'modified-asc'
  | 'alpha-asc'
  | 'alpha-desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'created-desc', label: 'Newest first' },
  { key: 'created-asc', label: 'Oldest first' },
  { key: 'modified-desc', label: 'Recently modified' },
  { key: 'modified-asc', label: 'Least recently modified' },
  { key: 'alpha-asc', label: 'Alphabetical (A–Z)' },
  { key: 'alpha-desc', label: 'Alphabetical (Z–A)' },
];

const SORT_KEY = 'manage:sort';

const primaryText = (note: Note) =>
  fieldToPlainText(Object.values(note.fields)[0] ?? '');

function sortNotes(notes: Note[], sort: SortKey): Note[] {
  const arr = [...notes];
  switch (sort) {
    case 'created-asc':
      return arr.sort((a, b) => a.created - b.created);
    case 'created-desc':
      return arr.sort((a, b) => b.created - a.created);
    case 'modified-asc':
      return arr.sort((a, b) => a.modified - b.modified);
    case 'modified-desc':
      return arr.sort((a, b) => b.modified - a.modified);
    case 'alpha-asc':
    case 'alpha-desc': {
      const dir = sort === 'alpha-asc' ? 1 : -1;
      return arr.sort(
        (a, b) =>
          dir *
          primaryText(a).localeCompare(primaryText(b), undefined, {
            sensitivity: 'base',
          })
      );
    }
  }
}

function SortMenu({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (key: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = SORT_OPTIONS.find((o) => o.key === value) ?? SORT_OPTIONS[0];
  const SortIcon = value.endsWith('-desc')
    ? ArrowDownWideNarrow
    : ArrowUpNarrowWide;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-semibold tracking-wide uppercase text-ink-300 transition-colors hover:text-ink-500">
        <SortIcon className="size-3" />
        {active.label}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-56 p-1">
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => {
              onChange(o.key);
              setOpen(false);
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-ink-700 transition-colors hover:bg-milk-200"
          >
            <Check
              className={`size-3 shrink-0 ${o.key === value ? 'opacity-100' : 'opacity-0'}`}
            />
            {o.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

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
  const [sort, setSort] = useState<SortKey>(() => {
    if (typeof window === 'undefined') return 'created-desc';
    const stored = localStorage.getItem(SORT_KEY) as SortKey | null;
    return SORT_OPTIONS.some((o) => o.key === stored)
      ? (stored as SortKey)
      : 'created-desc';
  });

  const handleSortChange = (key: SortKey) => {
    setSort(key);
    try {
      localStorage.setItem(SORT_KEY, key);
    } catch {
      /* ignore */
    }
  };

  const sortedNotes = useMemo(() => sortNotes(notes, sort), [notes, sort]);

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

      <div className="-my-1 -ml-2 flex items-center justify-start">
        <SortMenu value={sort} onChange={handleSortChange} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        {sortedNotes.length === 0 ? (
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
            {sortedNotes.map((note) => (
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
