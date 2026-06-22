import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { LayoutTemplate, Plus, Trash2, X } from 'lucide-react';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Badge } from '#/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '#/components/ui/dialog';
import {
  createTemplate,
  fetchTemplates,
  templatesKey,
} from '#/components/templates/api';

export const Route = createFileRoute('/templates/')({
  component: TemplatesPage,
});

function TemplatesPage() {
  const query = useQuery({
    queryKey: templatesKey,
    queryFn: fetchTemplates,
    retry: false,
  });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const templates = query.data?.templates ?? [];
  const orphans = query.data?.orphans ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LayoutTemplate className="size-5 text-ink-400" />
          <h1 className="font-display text-2xl text-ink-900">Templates</h1>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="bg-mint-700 text-white shadow-soft hover:-translate-y-px hover:bg-mint-800 hover:shadow-medium dark:text-cocoa-950"
        >
          <Plus /> New template
        </Button>
      </div>

      {query.isError && (
        <p className="text-sm text-destructive">
          Couldn’t load templates — is Anki running?
        </p>
      )}

      <div className="flex flex-col gap-2">
        {templates.map((t) => (
          <div
            key={t.modelId}
            className="group flex items-center rounded-xl border border-milk-200/70 bg-milk-50/70 pr-2 transition-colors hover:bg-milk-100"
          >
            <Link
              to="/templates/$modelId"
              params={{ modelId: String(t.modelId) }}
              className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-2 pl-4"
            >
              <span className="shrink-0 font-mono text-xs text-ink-300">
                {t.fields.length} field{t.fields.length === 1 ? '' : 's'}
              </span>
              {t.isCloze && <Badge variant="outline">cloze</Badge>}
              {t.customized ? (
                <Badge variant="secondary">customized</Badge>
              ) : (
                <Badge variant="ghost">default</Badge>
              )}
              <span className="flex-1 truncate text-right text-ink-800">
                {t.name}
              </span>
            </Link>
            <div className="w-0 shrink-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:w-8 group-hover:opacity-100 group-has-focus-visible:opacity-100">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Delete ${t.name}`}
                className="text-ink-300 hover:text-destructive"
                onClick={() => setDeleting(true)}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {orphans.length > 0 && (
        <p className="mt-6 text-xs text-ink-300">
          {orphans.length} saved layout
          {orphans.length === 1 ? '' : 's'} no longer match a note type in Anki
          ({orphans.map((o) => o.name).join(', ')}). Rename or delete note types
          in Anki desktop.
        </p>
      )}

      <CreateDialog open={creating} onClose={() => setCreating(false)} />
      <DeleteInfoDialog open={deleting} onClose={() => setDeleting(false)} />
    </div>
  );
}

function DeleteInfoDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Delete a note type in Anki</DialogTitle>
        <DialogDescription>
          AnkiConnect can’t delete note types, so this can’t be done from here.
          To remove one, open the Anki desktop app and go to{' '}
          <span className="text-ink-700">
            Tools → Manage Note Types → Delete
          </span>
          . Be careful — deleting a note type also deletes every note that uses
          it.
        </DialogDescription>

        <div className="mt-4 flex justify-end">
          <Button onClick={onClose}>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [fields, setFields] = useState<string[]>(['Front', 'Back']);

  const mutation = useMutation({
    mutationFn: () =>
      createTemplate({
        name: name.trim(),
        fields: fields.map((f) => f.trim()).filter(Boolean),
      }),
    onSuccess: (detail) => {
      qc.invalidateQueries({ queryKey: templatesKey });
      onClose();
      setName('');
      setFields(['Front', 'Back']);
      navigate({
        to: '/templates/$modelId',
        params: { modelId: String(detail.modelId) },
      });
    },
  });

  const valid =
    name.trim().length > 0 && fields.some((f) => f.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>New template</DialogTitle>
        <DialogDescription>
          Creates a note type in Anki with these fields, then opens the builder.
        </DialogDescription>

        <div className="mt-3 flex flex-col gap-3">
          <Input
            placeholder="Template name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            {fields.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder={`Field ${i + 1}`}
                  value={f}
                  onChange={(e) =>
                    setFields(
                      fields.map((v, j) => (j === i ? e.target.value : v))
                    )
                  }
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={fields.length <= 1}
                  onClick={() => setFields(fields.filter((_, j) => j !== i))}
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="self-start text-ink-400"
              onClick={() => setFields([...fields, ''])}
            >
              <Plus /> Add field
            </Button>
          </div>

          {mutation.error && (
            <p className="text-xs text-destructive">
              {(mutation.error as Error).message}
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
