import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { ChevronUp, Check, Trash2, SlidersHorizontal } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeckStatsItem } from '@nts/shared';
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
  displayName?: string;
  depth?: number;
  hasChildren?: boolean;
  subDeckCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isSelected?: boolean;
  onClick?: () => void;
}

const MASTERY_COLORS = [
  'bg-mint-500',
  'bg-terra',
  'bg-sky',
  'bg-lilac',
  'bg-mint-300',
];

function hashIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % MASTERY_COLORS.length;
}

export function DeckRow({
  deck,
  displayName,
  depth = 0,
  hasChildren,
  subDeckCount = 0,
  isCollapsed,
  onToggleCollapse,
  isSelected,
  onClick,
}: DeckRowProps) {
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
      style={depth ? { marginLeft: `${depth * 1.25}rem` } : undefined}
      className={`group flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer transition-colors ${
        isSelected ? 'bg-mint-500' : 'bg-milk-300 hover:bg-milk-400/60'
      }`}
      whileHover={{ scale: 0.985 }}
      whileTap={{ scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink-900 truncate">
          {displayName ?? deck.name}
        </div>
      </div>

      <Tooltip.Provider delay={200}>
        <Tooltip.Root>
          <Tooltip.Trigger
            className="group/mastery flex items-center gap-0.5 w-20 cursor-default"
            render={<div />}
          >
            <div
              className={`h-1.5 w-12 rounded-full overflow-hidden ${isSelected ? 'bg-white/30 dark:bg-cocoa-950/20' : 'bg-milk-400'}`}
            >
              <div
                className={`h-full rounded-full ${MASTERY_COLORS[idx]} transition-all`}
                style={{ width: `${mastery}%` }}
              />
            </div>
            <span
              className={`font-mono text-xs w-8 text-right transition-colors ${isSelected ? 'text-white dark:text-cocoa-950' : 'text-ink-300 group-hover/mastery:text-ink-500'}`}
            >
              {mastery}%
            </span>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner side="top" sideOffset={8}>
              <Tooltip.Popup className="z-50 w-44 rounded-md bg-[#3a7a5a] px-2.5 py-1.5 text-[10px] leading-snug text-white shadow-medium">
                <span className="font-semibold">Mastery at {mastery}%</span>
                <br />
                {deck.matureCards}/{deck.totalCards} cards in this deck have a
                review interval of 12 weeks or more.
                <Tooltip.Arrow className="fill-[#3a7a5a]" />
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>

      <div className="w-14 text-right">
        {isClear ? (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium ${isSelected ? 'text-white dark:text-cocoa-950' : 'text-ink-300'}`}
          >
            <Check className="size-3" />
            clear
          </span>
        ) : (
          <span
            className={`font-mono text-sm font-bold ${isSelected ? 'text-white dark:text-cocoa-950' : 'text-mint-700'}`}
          >
            {dueCount}
          </span>
        )}
      </div>

      <Link
        to="/manage/$deckName"
        params={{ deckName: deck.name }}
        onClick={(e) => e.stopPropagation()}
        title="Manage deck"
        aria-label="Manage deck"
        className={`flex size-7 items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100 ${isSelected ? 'text-white/60 hover:bg-white/15 hover:text-white dark:text-cocoa-950/60 dark:hover:bg-cocoa-950/15 dark:hover:text-cocoa-950' : 'text-ink-100 hover:bg-mint-500/10 hover:text-mint-700'}`}
      >
        <SlidersHorizontal className="size-3.5" />
      </Link>

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
          className={`flex size-7 items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100 ${isSelected ? 'text-white/60 hover:bg-white/15 hover:text-white dark:text-cocoa-950/60 dark:hover:bg-cocoa-950/15 dark:hover:text-cocoa-950' : 'text-ink-100 hover:bg-terra/10 hover:text-terra'}`}
        >
          <Trash2 className="size-3.5" />
        </button>

        <DialogContent
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="max-w-sm"
        >
          <DialogTitle className="text-base font-semibold text-ink-900">
            Delete deck?
          </DialogTitle>

          <div className="mt-2.5 inline-flex items-center gap-2 rounded-md bg-terra/8 border border-terra/15 px-3 py-2">
            <span className="font-display text-sm font-semibold text-terra">
              {deck.name}
            </span>
            <span className="text-terra/60 text-xs">→</span>
            <span>🗑️</span>
          </div>

          <DialogDescription className="mt-2.5 text-sm text-ink-500">
            This will permanently delete the deck
            {subDeckCount > 0 && (
              <>
                {' '}
                and its{' '}
                <strong className="text-ink-700">
                  {subDeckCount} sub-deck{subDeckCount > 1 ? 's' : ''}
                </strong>
              </>
            )}
            , including all{' '}
            <strong className="text-ink-700">{deck.totalCards}</strong> cards.
            This cannot be undone.
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

      {hasChildren ? (
        <motion.button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse?.();
          }}
          className={`flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors ${isSelected ? 'text-white/70 hover:text-white dark:text-cocoa-950/70 dark:hover:text-cocoa-950' : 'text-ink-300 hover:text-ink-700'}`}
          animate={{ rotate: isCollapsed ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <ChevronUp className="size-5" />
        </motion.button>
      ) : (
        <div className="w-7 shrink-0" />
      )}
    </motion.div>
  );
}
