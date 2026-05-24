import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronUp, Check, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeckStatsItem } from '@nts/dtos';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '#/components/ui/dialog';
import { Tooltip } from '@base-ui/react/tooltip';
import { Button } from '#/components/ui/button';

interface DeckRowProps {
  deck: DeckStatsItem;
  isSelected?: boolean;
  onClick?: () => void;
}

const GLYPH_COLORS = [
  'text-mint-700 bg-mint-50 border-mint-100',
  'text-apricot bg-apricot/10 border-apricot/20',
  'text-sky bg-sky/10 border-sky/20',
  'text-lilac bg-lilac/10 border-lilac/20',
  'text-terra bg-terra/10 border-terra/20',
  'text-ink-500 bg-butter/15 border-butter/25',
];

const MASTERY_COLORS = [
  'bg-mint-500',
  'bg-apricot',
  'bg-sky',
  'bg-lilac',
  'bg-terra',
  'bg-butter',
];

function hashIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % GLYPH_COLORS.length;
}

export function DeckRow({ deck, isSelected, onClick }: DeckRowProps) {
  const dueCount = deck.newCount + deck.learnCount + deck.reviewCount;
  const mastery =
    deck.totalCards > 0
      ? Math.round((deck.matureCards / deck.totalCards) * 100)
      : 0;
  const isClear = dueCount === 0;
  const idx = hashIndex(deck.name);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/anki/decks/${encodeURIComponent(deck.name)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    },
    onSuccess: () => {
      setDialogOpen(false);
      setConfirmed(false);
      queryClient.invalidateQueries({ queryKey: ['deck-stats'] });
      queryClient.invalidateQueries({ queryKey: ['review-pace'] });
    },
  });

  return (
    <motion.div
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-md px-4 py-3 cursor-pointer ${
        isSelected
          ? 'bg-milk-300/60 border-b border-milk-400/50'
          : 'border-b-2 border-milk-300 hover:bg-milk-300/50'
      }`}
      animate={{
        rotateX: isSelected ? 0 : 2,
        translateZ: isSelected ? 0 : 12,
        boxShadow: isSelected
          ? '0 1px 2px 0 rgba(44, 37, 35, 0.04)'
          : '0 4px 16px 0 rgba(44, 37, 35, 0.07), 0 1px 3px 0 rgba(44, 37, 35, 0.04)',
      }}
      whileHover={{
        scale: 0.985,
        ...(isSelected
          ? {
              boxShadow: '0 1px 3px 0 rgba(44, 37, 35, 0.05)',
            }
          : {
              rotateX: 0,
              translateZ: 6,
              boxShadow:
                '0 2px 8px 0 rgba(44, 37, 35, 0.06)',
            }),
      }}
      whileTap={{ scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div
        className={`flex size-12 shrink-0 items-center justify-center rounded-full border text-lg font-display ${GLYPH_COLORS[idx]}`}
      >
        {deck.name.charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink-900 truncate">
          {deck.name}
        </div>
      </div>

      <Tooltip.Provider delay={200}>
        <Tooltip.Root>
          <Tooltip.Trigger
            className="group/mastery flex items-center gap-0.5 w-20 cursor-default"
            render={<div />}
          >
            <div className="h-1.5 w-12 rounded-full bg-milk-400 overflow-hidden">
              <div
                className={`h-full rounded-full ${MASTERY_COLORS[idx]} transition-all`}
                style={{ width: `${mastery}%` }}
              />
            </div>
            <span className="font-mono text-xs text-ink-300 w-8 text-right transition-colors group-hover/mastery:text-ink-500">
              {mastery}%
            </span>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner side="top" sideOffset={8}>
              <Tooltip.Popup className="z-50 w-44 rounded-md bg-[#3a7a5a] px-2.5 py-1.5 text-[10px] leading-snug text-white shadow-medium">
                <span className="font-semibold">Mastery at {mastery}%</span>
                <br />
                Percentage of cards with a review interval of 12 weeks or
                more.
                <Tooltip.Arrow className="fill-[#3a7a5a]" />
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>

      <div className="w-14 text-right">
        {isClear ? (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-ink-300">
            <Check className="size-3" />
            clear
          </span>
        ) : (
          <span className="font-mono text-sm font-bold text-mint-700">
            {dueCount}
          </span>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setConfirmed(false);
            deleteMutation.reset();
          }
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDialogOpen(true);
          }}
          className="flex size-7 items-center justify-center rounded-md text-ink-100 opacity-0 transition-all hover:bg-terra/10 hover:text-terra group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>

        <DialogContent
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="max-w-sm"
        >
          <DialogTitle className="text-base font-semibold text-ink-900">
            Delete &ldquo;{deck.name}&rdquo;?
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-sm text-ink-500">
            This will permanently delete the deck and all{' '}
            <strong className="text-ink-700">{deck.totalCards}</strong> cards in
            it. This cannot be undone.
          </DialogDescription>

          {deleteMutation.isError && (
            <p className="mt-2 text-xs text-terra">
              Failed to delete deck. Is Anki running?
            </p>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            <DialogClose>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>

            {!confirmed ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmed(true)}
              >
                Delete deck
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Yes, I’m sure'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ChevronUp className="size-4 text-ink-100 transition-colors group-hover:text-ink-300" />
    </motion.div>
  );
}
