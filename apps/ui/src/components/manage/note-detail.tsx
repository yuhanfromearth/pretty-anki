import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Check, ChevronsUpDown, Trash2, Save, Plus } from 'lucide-react';
import type { Note, NoteModel, NoteFields } from '@nts/shared';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover';
import { Button } from '#/components/ui/button';
import { RichFieldEditor } from './rich-field-editor';
import { CardPreview } from './card-preview';
import { addNote, updateNote, deleteNote, notesKey } from './api';
import { fieldToPlainText } from './manage-media';

type PanelView = 'edit' | 'preview';

/** Edit / Preview segmented control shown atop the detail panel. The active
 *  pill slides between tabs via a shared `layoutId`. */
function ViewTabs({
  value,
  onChange,
  layoutId,
}: {
  value: PanelView;
  onChange: (v: PanelView) => void;
  layoutId: string;
}) {
  // Left/right arrows toggle the view, except while typing in a field (search
  // input or a rich field editor) where arrows must move the caret instead.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      )
        return;
      onChange(e.key === 'ArrowLeft' ? 'edit' : 'preview');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onChange]);

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-milk-300/70 bg-milk-100/60 p-0.5">
      {(['edit', 'preview'] as const).map((t) => {
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={`relative rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
              active ? 'text-mint-700' : 'text-ink-400 hover:text-ink-600'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-md bg-mint-500/15 ring-1 ring-inset ring-mint-500/30"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{t}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Renders one rich editor per field. Editors are keyed by field name so they
 *  remount cleanly when the note type (and thus field set) changes. */
function FieldStack({
  fieldNames,
  values,
  onChange,
  onInit,
  autoFocusFirst,
}: {
  fieldNames: string[];
  values: NoteFields;
  onChange: (name: string, html: string) => void;
  onInit?: (name: string, html: string) => void;
  autoFocusFirst?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {fieldNames.map((name, i) => (
        <div key={name} className="space-y-1.5">
          <label className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-300">
            {name}
          </label>
          <RichFieldEditor
            value={values[name] ?? ''}
            onChange={(html) => onChange(name, html)}
            onInit={onInit ? (html) => onInit(name, html) : undefined}
            autoFocus={autoFocusFirst && i === 0}
          />
        </div>
      ))}
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatTimestamp(ms: number): string {
  return dateFmt.format(new Date(ms));
}

/** Creation / modification dates shown atop the edit panel. */
function NoteDates({
  created,
  modified,
}: {
  created: number;
  modified: number;
}) {
  return (
    <p className="mt-1.5 font-mono text-[11px] text-ink-300">
      Created {formatTimestamp(created)}
      <span className="mx-1.5 text-ink-200">·</span>
      Modified {formatTimestamp(modified)}
    </p>
  );
}

function PanelHeader({
  label,
  title,
  korean,
}: {
  label: string;
  title: string;
  korean?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-300">
        {label}
      </p>
      <h2
        className={`truncate text-lg font-semibold text-ink-900 ${
          korean ? 'font-korean' : 'font-display'
        }`}
      >
        {title}
      </h2>
    </div>
  );
}

interface EditPanelProps {
  note: Note;
  deckName: string;
  search: string;
  onDirtyChange: (dirty: boolean) => void;
  onDeleted: () => void;
}

export function NoteEditPanel({
  note,
  deckName,
  search,
  onDirtyChange,
  onDeleted,
}: EditPanelProps) {
  const queryClient = useQueryClient();
  const fieldNames = useMemo(() => Object.keys(note.fields), [note.fields]);
  const [values, setValues] = useState<NoteFields>(note.fields);
  const [baseline, setBaseline] = useState<NoteFields>(note.fields);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [view, setView] = useState<PanelView>('edit');

  const dirty = useMemo(
    () => fieldNames.some((n) => (values[n] ?? '') !== (baseline[n] ?? '')),
    [fieldNames, values, baseline]
  );

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // The editor re-serializes content into its own canonical markup, which
  // rarely matches Anki's stored HTML byte-for-byte. Baseline against that
  // canonical form (emitted once on mount) so a no-op edit isn't seen as dirty.
  const handleFieldInit = useCallback((name: string, html: string) => {
    setBaseline((b) => (b[name] === html ? b : { ...b, [name]: html }));
    setValues((v) => (v[name] === html ? v : { ...v, [name]: html }));
  }, []);

  const save = useMutation({
    mutationFn: () => updateNote(note.noteId, values),
    onSuccess: () => {
      setBaseline(values);
      queryClient.invalidateQueries({ queryKey: notesKey(deckName, search) });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteNote(note.noteId),
    onSuccess: () => {
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: notesKey(deckName, search) });
      queryClient.invalidateQueries({ queryKey: ['deck-stats'] });
      onDeleted();
    },
  });

  const title = fieldToPlainText(values[fieldNames[0]] ?? '') || '(empty)';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <PanelHeader
          label={note.modelName}
          title={title}
          korean={/[가-힯一-鿿]/.test(title)}
        />
        <Popover open={confirmOpen} onOpenChange={setConfirmOpen}>
          <PopoverTrigger
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-terra/10 hover:text-terra aria-expanded:bg-terra/10 aria-expanded:text-terra"
            title="Delete card"
            aria-label="Delete card"
          >
            <Trash2 className="size-4" />
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={6} className="w-60 gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-900">
                Delete this card?
              </p>
              <p className="mt-1 text-xs text-ink-500">
                The note and all of its cards are permanently removed from your
                collection. This can't be undone.
              </p>
            </div>
            {remove.isError && (
              <p className="text-xs text-terra">
                Couldn't delete. Is Anki running?
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                {remove.isPending ? 'Deleting…' : 'Delete card'}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <NoteDates created={note.created} modified={note.modified} />

      <div className="mt-4">
        <ViewTabs value={view} onChange={setView} layoutId="edit-view-tab" />
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {view === 'edit' ? (
          <FieldStack
            fieldNames={fieldNames}
            values={values}
            onChange={(name, html) =>
              setValues((v) => ({ ...v, [name]: html }))
            }
            onInit={handleFieldInit}
          />
        ) : (
          <CardPreview fieldNames={fieldNames} values={values} />
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-milk-200/70 pt-4">
        <span className="text-xs text-ink-300">
          {save.isError
            ? 'Save failed. Is Anki running?'
            : dirty
              ? 'Unsaved changes'
              : save.isSuccess
                ? 'All changes saved'
                : ' '}
        </span>
        <Button
          size="sm"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
          className="bg-mint-500 text-white hover:bg-mint-700 dark:text-cocoa-950"
        >
          <Save className="size-3.5" />
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

interface AddPanelProps {
  deckName: string;
  search: string;
  models: NoteModel[];
  modelName: string;
  onModelChange: (name: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}

function emptyFields(model: NoteModel | undefined): NoteFields {
  const out: NoteFields = {};
  for (const f of model?.fields ?? []) out[f] = '';
  return out;
}

export function AddNotePanel({
  deckName,
  search,
  models,
  modelName,
  onModelChange,
  onDirtyChange,
}: AddPanelProps) {
  const queryClient = useQueryClient();
  const model = useMemo(
    () => models.find((m) => m.name === modelName) ?? models[0],
    [models, modelName]
  );

  const [values, setValues] = useState<NoteFields>(() => emptyFields(model));
  // Bumping this key remounts the field editors to clear them after an add or
  // a note-type switch.
  const [resetKey, setResetKey] = useState(0);
  const [modelOpen, setModelOpen] = useState(false);
  const [view, setView] = useState<PanelView>('edit');

  const firstFieldName = model?.fields[0];
  const firstEmpty = !fieldToPlainText(values[firstFieldName ?? ''] ?? '');
  const dirty = useMemo(
    () => Object.values(values).some((v) => v.trim().length > 0),
    [values]
  );

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const reset = (next: NoteModel | undefined) => {
    setValues(emptyFields(next));
    setResetKey((k) => k + 1);
  };

  const add = useMutation({
    mutationFn: () =>
      addNote({ deckName, modelName: model!.name, fields: values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKey(deckName, search) });
      queryClient.invalidateQueries({ queryKey: ['deck-stats'] });
      reset(model);
    },
  });

  if (!model) {
    return (
      <p className="py-16 text-center text-sm text-ink-300">
        No note types available.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3">
        <PanelHeader label="New card" title={`Add to ${deckName}`} />
        <Popover open={modelOpen} onOpenChange={setModelOpen}>
          <PopoverTrigger
            className="flex h-8 items-center gap-1.5 rounded-lg border border-milk-300/70 bg-milk-50/70 px-2.5 text-xs font-medium text-ink-700 transition-colors hover:border-mint-400 aria-expanded:border-mint-400"
            title="Note type"
          >
            <span className="max-w-[10rem] truncate">{model.name}</span>
            <ChevronsUpDown className="size-3.5 text-ink-300" />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="max-h-72 w-56 gap-0.5 overflow-y-auto p-1"
          >
            {models.map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => {
                  onModelChange(m.name);
                  reset(m);
                  setModelOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-ink-700 transition-colors hover:bg-milk-200"
              >
                <Check
                  className={`size-3 shrink-0 ${m.name === model.name ? 'opacity-100' : 'opacity-0'}`}
                />
                <span className="truncate">{m.name}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <div className="mt-4">
        <ViewTabs value={view} onChange={setView} layoutId="add-view-tab" />
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {view === 'edit' ? (
          <FieldStack
            key={`${model.name}-${resetKey}`}
            fieldNames={model.fields}
            values={values}
            onChange={(name, html) =>
              setValues((v) => ({ ...v, [name]: html }))
            }
            autoFocusFirst
          />
        ) : (
          <CardPreview fieldNames={model.fields} values={values} />
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-milk-200/70 pt-4">
        <span className="text-xs text-ink-300">
          {add.isError ? (
            <span className="text-terra">{add.error.message}</span>
          ) : add.isSuccess ? (
            'Card added — keep going'
          ) : (
            ' '
          )}
        </span>
        <Button
          size="sm"
          disabled={firstEmpty || add.isPending}
          onClick={() => add.mutate()}
          className="bg-mint-500 text-white hover:bg-mint-700 dark:text-cocoa-950"
        >
          <Plus className="size-3.5" />
          {add.isPending ? 'Adding…' : 'Add card'}
        </Button>
      </div>
    </div>
  );
}
