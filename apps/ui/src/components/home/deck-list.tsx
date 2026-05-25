import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check } from 'lucide-react';
import type { DeckStats, DeckStatsItem } from '@nts/dtos';
import { DeckRow } from './deck-row';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover';

type SortKey = 'reviews-desc' | 'reviews-asc' | 'mastery-desc' | 'mastery-asc' | 'alpha-asc' | 'alpha-desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'reviews-desc', label: 'Reviews: high → low' },
  { key: 'reviews-asc', label: 'Reviews: low → high' },
  { key: 'mastery-desc', label: 'Mastery: high → low' },
  { key: 'mastery-asc', label: 'Mastery: low → high' },
  { key: 'alpha-asc', label: 'Name: A → Z' },
  { key: 'alpha-desc', label: 'Name: Z → A' },
];

function getDueCount(deck: DeckStatsItem) {
  return deck.newCount + deck.learnCount + deck.reviewCount;
}

function getMastery(deck: DeckStatsItem) {
  return deck.totalCards > 0 ? deck.matureCards / deck.totalCards : 0;
}

function sortDecks(decks: DeckStatsItem[], key: SortKey): DeckStatsItem[] {
  const sorted = [...decks];
  const [field, dir] = key.split('-') as [string, string];
  const mult = dir === 'desc' ? -1 : 1;

  if (field === 'alpha') {
    return sorted.sort((a, b) => mult * a.name.localeCompare(b.name));
  }

  const getValue = field === 'reviews' ? getDueCount : getMastery;
  return sorted.sort((a, b) => mult * (getValue(a) - getValue(b)));
}

interface DeckListProps {
  deckStats: DeckStats;
  selectedDeck: string | null;
  onSelectDeck?: (name: string) => void;
}

export function DeckList({
  deckStats,
  selectedDeck,
  onSelectDeck,
}: DeckListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('reviews-desc');
  const [open, setOpen] = useState(false);

  const sortedDecks = useMemo(
    () => sortDecks(deckStats.decks, sortKey),
    [deckStats.decks, sortKey]
  );

  const activeLabel = SORT_OPTIONS.find((o) => o.key === sortKey)!.label;
  const SortIcon = sortKey.endsWith('-desc')
    ? ArrowDownWideNarrow
    : ArrowUpNarrowWide;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-ink-300">
          all decks
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-semibold tracking-wide uppercase text-ink-300 transition-colors hover:text-ink-500"
          >
            <SortIcon className="size-3" />
            {activeLabel}
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-48 p-1"
          >
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  setSortKey(opt.key);
                  setOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-ink-700 transition-colors hover:bg-milk-200"
              >
                <Check
                  className={`size-3 ${opt.key === sortKey ? 'opacity-100' : 'opacity-0'}`}
                />
                {opt.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-2">
          {sortedDecks.map((deck) => (
            <DeckRow
              key={deck.name}
              deck={deck}
              isSelected={deck.name === selectedDeck}
              onClick={() => onSelectDeck?.(deck.name)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
