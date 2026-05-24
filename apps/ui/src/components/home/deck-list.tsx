import type { DeckStats } from '@nts/dtos';
import { DeckRow } from './deck-row';

interface DeckListProps {
  deckStats: DeckStats;
  onSelectDeck?: (name: string) => void;
}

export function DeckList({ deckStats, onSelectDeck }: DeckListProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-ink-300">
          all decks
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-2">
          {deckStats.decks.map((deck) => (
            <DeckRow
              key={deck.name}
              deck={deck}
              onClick={() => onSelectDeck?.(deck.name)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
