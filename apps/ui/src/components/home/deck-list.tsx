import type { DeckStats } from '@nts/dtos';
import { DeckRow } from './deck-row';

interface DeckListProps {
  deckStats: DeckStats;
}

export function DeckList({ deckStats }: DeckListProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-ink-300">
          all decks
        </span>
      </div>

      <div className="grid gap-2">
        {deckStats.decks.map((deck) => (
          <DeckRow key={deck.name} deck={deck} />
        ))}
      </div>
    </section>
  );
}
