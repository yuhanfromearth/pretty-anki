import { ChevronRight, Check } from 'lucide-react';
import type { DeckStatsItem } from '@nts/dtos';

interface DeckRowProps {
  deck: DeckStatsItem;
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

export function DeckRow({ deck }: DeckRowProps) {
  const dueCount = deck.newCount + deck.learnCount + deck.reviewCount;
  const mastery =
    deck.totalCards > 0
      ? Math.round((deck.matureCards / deck.totalCards) * 100)
      : 0;
  const isClear = dueCount === 0;
  const idx = hashIndex(deck.name);

  return (
    <div className="group flex items-center gap-3 rounded-md border-b-2 border-milk-300 px-4 py-3 cursor-pointer transition-colors hover:bg-milk-300/50">
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

      <div className="relative flex items-center gap-0.5 w-20 group/mastery">
        <div className="h-1.5 w-12 rounded-full bg-milk-400 overflow-hidden">
          <div
            className={`h-full rounded-full ${MASTERY_COLORS[idx]} transition-all`}
            style={{ width: `${mastery}%` }}
          />
        </div>
        <span className="font-mono text-xs text-ink-300 w-8 text-right">
          {mastery}%
        </span>
        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 rounded-md bg-mint-700 px-2.5 py-1.5 text-[10px] leading-snug text-white opacity-0 shadow-medium transition-opacity group-hover/mastery:opacity-100">
          <span className="font-semibold">Mastery at {mastery}%</span>
          <br />
          Percentage of cards with a review interval of 12 weeks or more.
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-mint-700" />
        </div>
      </div>

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

      <ChevronRight className="size-4 text-ink-100 transition-colors group-hover:text-ink-300" />
    </div>
  );
}
