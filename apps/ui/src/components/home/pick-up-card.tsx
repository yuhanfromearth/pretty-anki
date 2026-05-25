import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import type { DeckStatsItem } from '@nts/dtos';

interface PickUpCardProps {
  deck: DeckStatsItem;
}

export function PickUpCard({ deck }: PickUpCardProps) {
  const dueNow = deck.newCount + deck.learnCount + deck.reviewCount;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-milk-50/90 border border-milk-200/60 px-6 py-5 shadow-soft">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_40%,rgba(234,219,200,0.3)_0%,transparent_60%)] dark:bg-[radial-gradient(circle_at_85%_40%,rgba(247,236,210,0.04)_0%,transparent_60%)]" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            pick up where you left
          </p>
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink-900">
              {deck.name}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {deck.learnCount > 0 && (
              <span className="rounded-full border border-apricot/40 bg-apricot/10 px-3 py-0.5 text-xs font-medium text-[#b8884e] dark:text-apricot">
                {deck.learnCount} learning
              </span>
            )}
            {deck.reviewCount > 0 && (
              <span className="rounded-full border border-mint-300 bg-mint-500/10 px-3 py-0.5 text-xs font-medium text-mint-700 dark:text-mint-300">
                {deck.reviewCount} review
              </span>
            )}
            {deck.newCount > 0 && (
              <span className="rounded-full border border-lilac/40 bg-lilac/10 px-3 py-0.5 text-xs font-medium text-[#9177c0] dark:text-lilac">
                {deck.newCount} new
              </span>
            )}
          </div>
          <Link
            to="/review/$deckName"
            params={{ deckName: deck.name }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-mint-500 px-5 py-2.5 text-sm font-medium text-white dark:text-cocoa-950 shadow-soft transition-colors hover:bg-mint-700"
          >
            Start review
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-20 items-center justify-center rounded-full bg-milk-200/80 border border-milk-300/60 font-display text-3xl text-ink-700">
            {deck.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-display text-5xl font-bold tracking-tight text-ink-900">
            {dueNow}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-300">
            due now
          </span>
        </div>
      </div>
    </div>
  );
}
