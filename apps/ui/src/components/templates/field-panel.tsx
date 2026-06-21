import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import type { FieldOp, TemplateDetail } from '@nts/shared';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '#/components/ui/dialog';
import { applyFieldOp, templatesKey } from './api';

/** Edits the note type's fields (which live in Anki) as compact chips: click a
 *  chip's name to rename inline, ✕ to remove. Remove is gated behind a typed
 *  confirmation showing the affected note count, since it drops data on every
 *  note. The backend keeps the layout consistent (rename remaps blocks, remove
 *  cascades) and returns the detail pushed back up.
 *
 *  Field order is normally hidden — placement is owned by the block stacks, so
 *  order would only mislead. But cloze types have no block stacks (Anki renders
 *  them), making Anki's field order their only placement lever; pass
 *  `reorderable` there to show ‹ › controls that dispatch the reposition op. */
export function FieldPanel({
  modelId,
  fields,
  noteCount,
  onApplied,
  reorderable = false,
}: {
  modelId: number;
  fields: string[];
  noteCount: number;
  onApplied: (detail: TemplateDetail) => void;
  reorderable?: boolean;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState('');
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(
    null
  );
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const mutation = useMutation({
    mutationFn: (op: FieldOp) => applyFieldOp(modelId, op),
    onSuccess: (detail) => {
      onApplied(detail);
      qc.invalidateQueries({ queryKey: templatesKey });
    },
  });

  const run = (op: FieldOp) => mutation.mutate(op);

  const commitRename = () => {
    if (
      renaming &&
      renaming.to.trim() &&
      renaming.to.trim() !== renaming.from
    ) {
      run({ op: 'rename', from: renaming.from, to: renaming.to.trim() });
    }
    setRenaming(null);
  };

  const commitAdd = () => {
    if (adding.trim()) {
      run({ op: 'add', name: adding.trim() });
      setAdding('');
    }
  };

  const addControl = (
    <span className="inline-flex items-center gap-1">
      <Input
        className="h-8 w-32"
        placeholder="New field"
        value={adding}
        onChange={(e) => setAdding(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commitAdd()}
      />
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={!adding.trim()}
        onClick={commitAdd}
        title="Add field"
      >
        <Plus />
      </Button>
    </span>
  );

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-300">
        Fields
      </span>

      {mutation.error && (
        <p className="text-xs text-destructive">
          {(mutation.error as Error).message}
        </p>
      )}

      {reorderable ? (
        // Cloze types: a vertical list with stacked up/down controls, matching
        // the block-stack reorder idiom, since Anki's field order is their only
        // placement lever.
        <div className="flex flex-col gap-2">
          {fields.map((field, i) => (
            <div
              key={field}
              className="flex items-center gap-1.5 rounded-xl border border-milk-200/70 bg-milk-50/70 p-2.5"
            >
              <div className="flex shrink-0 flex-col">
                <button
                  className="flex size-4 items-center justify-center text-ink-300 hover:text-ink-600 disabled:opacity-30"
                  disabled={i === 0}
                  aria-label={`Move ${field} up`}
                  onClick={() =>
                    run({ op: 'reposition', name: field, index: i - 1 })
                  }
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  className="flex size-4 items-center justify-center text-ink-300 hover:text-ink-600 disabled:opacity-30"
                  disabled={i === fields.length - 1}
                  aria-label={`Move ${field} down`}
                  onClick={() =>
                    run({ op: 'reposition', name: field, index: i + 1 })
                  }
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>

              {renaming?.from === field ? (
                <Input
                  className="h-8 flex-1"
                  value={renaming.to}
                  autoFocus
                  onChange={(e) =>
                    setRenaming({ from: field, to: e.target.value })
                  }
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                <button
                  className="flex-1 truncate text-left text-sm text-ink-700 hover:text-ink-900"
                  title="Rename field"
                  onClick={() => setRenaming({ from: field, to: field })}
                >
                  {field}
                </button>
              )}

              <button
                className="flex size-5 shrink-0 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-milk-200 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                title="Remove field"
                disabled={fields.length <= 1}
                onClick={() => {
                  setRemoving(field);
                  setConfirmText('');
                }}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}

          <div className="self-start">{addControl}</div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {fields.map((field) =>
            renaming?.from === field ? (
              <Input
                key={field}
                className="h-8 w-32"
                value={renaming.to}
                autoFocus
                onChange={(e) =>
                  setRenaming({ from: field, to: e.target.value })
                }
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenaming(null);
                }}
              />
            ) : (
              <span
                key={field}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-milk-300/80 bg-milk-50/80 pr-1 pl-3 text-sm text-ink-700"
              >
                <button
                  className="max-w-44 truncate hover:text-ink-900"
                  title="Rename field"
                  onClick={() => setRenaming({ from: field, to: field })}
                >
                  {field}
                </button>
                <button
                  className="flex size-5 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-milk-200 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                  title="Remove field"
                  disabled={fields.length <= 1}
                  onClick={() => {
                    setRemoving(field);
                    setConfirmText('');
                  }}
                >
                  <X className="size-3" />
                </button>
              </span>
            )
          )}

          {addControl}
        </div>
      )}

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <DialogContent>
          <DialogTitle>Remove field “{removing}”?</DialogTitle>
          <DialogDescription>
            {noteCount > 0
              ? `This permanently deletes this field's data from ${noteCount} note${noteCount === 1 ? '' : 's'} in Anki. Type the field name to confirm.`
              : 'This note type has no notes yet, so no data is lost.'}
          </DialogDescription>
          {noteCount > 0 && (
            <Input
              className="mt-2"
              placeholder={removing ?? ''}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={noteCount > 0 && confirmText !== removing}
              onClick={() => {
                if (removing) {
                  run({ op: 'remove', name: removing, confirm: true });
                }
                setRemoving(null);
              }}
            >
              Remove field
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
