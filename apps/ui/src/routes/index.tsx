import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { DeckStats, ReviewPace } from '@nts/shared';
import { Greeting } from '#/components/home/greeting';
import { PickUpCard } from '#/components/home/pick-up-card';
import { DeckList } from '#/components/home/deck-list';

export const Route = createFileRoute('/')({ component: HomePage });

class ServerError extends Error {
  constructor(url: string, status: number) {
    super(`${url}: ${status}`);
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url);
  } catch {
    throw new TypeError(`Failed to fetch ${url}`);
  }
  if (!r.ok) throw new ServerError(url, r.status);
  return r.json() as Promise<T>;
}

function isServerDown(error: Error | null): boolean {
  return error instanceof TypeError;
}

function HomePage() {
  const deckStats = useQuery<DeckStats>({
    queryKey: ['deck-stats'],
    queryFn: () => fetchJson<DeckStats>('/api/anki/deck-stats'),
    retry: false,
  });

  const reviewPace = useQuery<ReviewPace>({
    queryKey: ['review-pace'],
    queryFn: () => fetchJson<ReviewPace>('/api/anki/review-pace'),
    retry: false,
  });

  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);

  const isLoading = deckStats.isPending || reviewPace.isPending;

  const hasError = deckStats.error || reviewPace.error;

  if (hasError) {
    const serverDown = isServerDown(
      deckStats.error ?? reviewPace.error ?? null
    );
    return (
      <ErrorState
        serverDown={serverDown}
        onRetry={() => {
          deckStats.refetch();
          reviewPace.refetch();
        }}
      />
    );
  }

  if (isLoading) {
    return <LoadingState />;
  }

  const pickUpDeck = findPickUpDeck(deckStats.data!);

  const displayDeck =
    deckStats.data?.decks.find((d) => d.name === selectedDeck) ?? pickUpDeck;

  return (
    <div className="flex h-full flex-col gap-8">
      <Greeting deckStats={deckStats.data} reviewPace={reviewPace.data} />

      {displayDeck && <PickUpCard deck={displayDeck} />}

      {deckStats.data && (
        <DeckList
          deckStats={deckStats.data}
          selectedDeck={selectedDeck}
          onSelectDeck={setSelectedDeck}
        />
      )}
    </div>
  );
}

function findPickUpDeck(stats: DeckStats) {
  const decksWithDue = stats.decks.filter(
    (d) => d.newCount + d.learnCount + d.reviewCount > 0
  );

  if (decksWithDue.length === 0) return null;

  return decksWithDue.reduce((best, deck) => {
    const bestDue = best.newCount + best.learnCount + best.reviewCount;
    const deckDue = deck.newCount + deck.learnCount + deck.reviewCount;
    return deckDue > bestDue ? deck : best;
  });
}

function ErrorState({
  serverDown,
  onRetry,
}: {
  serverDown: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="size-16 rounded-2xl bg-terra/10 border border-terra/30 flex items-center justify-center mb-4">
        <span className="text-2xl">{serverDown ? '🔌' : '⚡'}</span>
      </div>
      <h2 className="text-lg font-semibold text-ink-900 mb-1">
        {serverDown ? 'Server unavailable' : "Can't reach Anki"}
      </h2>
      <p className="text-sm text-ink-500 max-w-xs mb-6">
        {serverDown
          ? 'The app server is not running. Start it and try again.'
          : 'Make sure Anki is running with the AnkiConnect add-on enabled on port 8765.'}
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl bg-mint-500 px-4 py-2 text-sm font-medium text-white dark:text-cocoa-950 shadow-soft transition-colors hover:bg-mint-700"
      >
        <RefreshCw className="size-4" />
        Try again
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3 py-24 justify-center text-ink-300 text-sm">
      <span className="size-4 rounded-full border-2 border-ink-100 border-t-mint-500 animate-spin" />
      Loading your decks...
    </div>
  );
}
