import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '#/components/ui/dialog';
import { Input } from '#/components/ui/input';
import { Button } from '#/components/ui/button';
import { Label } from '#/components/ui/label';

interface CreateDeckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingDecks: string[];
  onCreated: (name: string) => void;
}

export function CreateDeckDialog({
  open,
  onOpenChange,
  existingDecks,
  onCreated,
}: CreateDeckDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  const duplicate = existingDecks.some(
    (d) => d.toLowerCase() === name.trim().toLowerCase()
  );

  const mutation = useMutation({
    mutationFn: async (deckName: string) => {
      const res = await fetch('/api/anki/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deckName }),
      });
      if (!res.ok) throw new Error(`Create failed: ${res.status}`);
    },
    onSuccess: (_, deckName) => {
      queryClient.invalidateQueries({ queryKey: ['deck-stats'] });
      onOpenChange(false);
      onCreated(deckName);
    },
  });

  const canSubmit = name.trim().length > 0 && !duplicate && !mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) mutation.mutate(name.trim());
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) mutation.reset();
      }}
    >
      <DialogContent className="max-w-sm p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-ink-300">
              New deck
            </p>
            <DialogTitle className="font-display text-lg font-semibold text-ink-900">
              Create a deck.
            </DialogTitle>
          </div>
          <DialogClose className="flex size-7 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-milk-100 hover:text-ink-500">
            <X className="size-4" />
          </DialogClose>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="deck-name" className="text-ink-600">
              Deck name
            </Label>
            <Input
              id="deck-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Korean Core 2k"
              autoFocus
            />
            <p className="text-[11px] text-ink-300">
              Use <span className="font-mono text-ink-400">::</span> to create
              nested decks, e.g.{' '}
              <span className="font-mono text-ink-400">
                Korean::Basic Sentences
              </span>
            </p>
            {duplicate && (
              <p className="text-xs text-terra">
                A deck with this name already exists.
              </p>
            )}
            {mutation.isError && (
              <p className="text-xs text-terra">
                Failed to create deck. Is Anki running?
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-mint-600 text-white hover:bg-mint-700"
          >
            {mutation.isPending ? 'Creating...' : 'Create deck'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
