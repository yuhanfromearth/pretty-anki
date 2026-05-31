import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Layers } from 'lucide-react';
import type { Note } from '@nts/shared';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '#/components/ui/dialog';
import { Button } from '#/components/ui/button';
import { NoteList } from '#/components/manage/note-list';
import { NoteEditPanel, AddNotePanel } from '#/components/manage/note-detail';
import { fetchNotes, fetchModels, notesKey } from '#/components/manage/api';

export const Route = createFileRoute('/manage/$deckName')({
  validateSearch: (search: Record<string, unknown>): { noteId?: number } => {
    const n = Number(search.noteId);
    return Number.isFinite(n) && n > 0 ? { noteId: n } : {};
  },
  component: ManagePage,
});

type Selection = { mode: 'add' } | { mode: 'edit'; note: Note } | null;

const LAST_MODEL_KEY = 'manage:last-model';

function ManagePage() {
  const { deckName } = Route.useParams();
  const { noteId: targetNoteId } = Route.useSearch();
  const decoded = decodeURIComponent(deckName);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const notesQuery = useQuery({
    queryKey: notesKey(decoded, debounced),
    queryFn: () => fetchNotes(decoded, debounced),
    retry: false,
    placeholderData: (prev) => prev,
  });
  const modelsQuery = useQuery({
    queryKey: ['note-models'],
    queryFn: fetchModels,
    retry: false,
  });

  const notes = notesQuery.data?.notes ?? [];

  const [selection, setSelection] = useState<Selection>(null);
  const [modelName, setModelName] = useState('');

  // Dirty-switch guard: a pending navigation is parked until the user confirms
  // discarding unsaved edits.
  const dirtyRef = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);

  const handleDirty = useCallback((d: boolean) => {
    dirtyRef.current = d;
  }, []);

  const guard = useCallback((action: () => void) => {
    if (dirtyRef.current) {
      setPending(() => action);
    } else {
      action();
    }
  }, []);

  const confirmDiscard = () => {
    handleDirty(false);
    pending?.();
    setPending(null);
  };

  // Initial selection on first load only. When a `noteId` search param is
  // present (e.g. arriving from the review screen's edit button) we select that
  // note; otherwise we fall back to the first note. We deliberately don't
  // re-select afterwards so that deleting a card clears the editor (shows the
  // empty state) instead of jumping to another card's fields.
  // The selected note is held by value so that filtering the list (e.g. while
  // typing in search) never unmounts the editor and discards unsaved edits.
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (didAutoSelect.current || selection !== null || notes.length === 0)
      return;
    didAutoSelect.current = true;
    const target =
      targetNoteId != null
        ? notes.find((n) => n.noteId === targetNoteId)
        : undefined;
    setSelection({ mode: 'edit', note: target ?? notes[0] });
  }, [selection, notes, targetNoteId]);

  const handleModelChange = (name: string) => {
    setModelName(name);
    try {
      localStorage.setItem(LAST_MODEL_KEY, name);
    } catch {
      /* ignore */
    }
  };

  const effectiveModel =
    modelName ||
    (typeof window !== 'undefined'
      ? (localStorage.getItem(LAST_MODEL_KEY) ?? '')
      : '');

  const error = notesQuery.error ?? modelsQuery.error;
  if (error) {
    return (
      <ErrorState
        serverDown={error instanceof TypeError}
        onRetry={() => {
          notesQuery.refetch();
          modelsQuery.refetch();
        }}
      />
    );
  }

  const loading = notesQuery.isPending || modelsQuery.isPending;

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden rounded-2xl border border-milk-200/60 bg-milk-50/90 shadow-soft md:grid-cols-[300px_1fr]">
        <div className="flex min-h-0 flex-col border-b border-milk-200/60 p-4 md:border-b-0 md:border-r">
          {loading ? (
            <ListSkeleton />
          ) : (
            <NoteList
              notes={notes}
              selectedNoteId={
                selection?.mode === 'edit' ? selection.note.noteId : null
              }
              scrollToNoteId={targetNoteId ?? null}
              addActive={selection?.mode === 'add'}
              search={search}
              onSearchChange={setSearch}
              onSelect={(note) =>
                guard(() => setSelection({ mode: 'edit', note }))
              }
              onAdd={() => guard(() => setSelection({ mode: 'add' }))}
              isFetching={notesQuery.isFetching}
              truncated={notesQuery.data?.truncated ?? false}
            />
          )}
        </div>
        <div className="min-h-0 overflow-hidden p-5">
          {loading ? null : selection?.mode === 'add' ? (
            <AddNotePanel
              key="add"
              deckName={decoded}
              search={debounced}
              models={modelsQuery.data?.models ?? []}
              modelName={effectiveModel}
              onModelChange={handleModelChange}
              onDirtyChange={handleDirty}
            />
          ) : selection?.mode === 'edit' ? (
            <NoteEditPanel
              key={`edit-${selection.note.noteId}`}
              note={selection.note}
              deckName={decoded}
              search={debounced}
              onDirtyChange={handleDirty}
              onDeleted={() => setSelection(null)}
            />
          ) : (
            <EmptyDetail />
          )}
        </div>
      </div>

      <Dialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) setPending(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-base font-semibold text-ink-900">
            Discard unsaved changes?
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-ink-500">
            You have edits that haven't been saved. Leaving now will discard
            them.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
              Keep editing
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDiscard}>
              Discard changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-milk-200 bg-milk-100/70 text-ink-300">
        <Layers className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-ink-500">No card selected</p>
        <p className="text-xs text-ink-300">
          Pick a card from the list, or add a new one.
        </p>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-9 w-full animate-pulse rounded-xl bg-milk-200/70" />
      <div className="mt-2 flex flex-col gap-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-full animate-pulse rounded-lg bg-milk-200/50"
          />
        ))}
      </div>
    </div>
  );
}

function ErrorState({
  serverDown,
  onRetry,
}: {
  serverDown: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-terra/30 bg-terra/10">
        <span className="text-2xl">{serverDown ? '🔌' : '⚡'}</span>
      </div>
      <h2 className="mb-1 text-lg font-semibold text-ink-900">
        {serverDown ? 'Server unavailable' : "Can't reach Anki"}
      </h2>
      <p className="mb-6 max-w-xs text-sm text-ink-500">
        {serverDown
          ? 'The app server is not running. Start it and try again.'
          : 'Make sure Anki is running with the AnkiConnect add-on enabled on port 8765.'}
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl bg-mint-500 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors hover:bg-mint-700 dark:text-cocoa-950"
      >
        <RefreshCw className="size-4" />
        Try again
      </button>
    </div>
  );
}
