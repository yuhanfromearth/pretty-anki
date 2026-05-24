import { useQuery } from '@tanstack/react-query';
import type { DeckStats, ReviewPace, UserSettings } from '@nts/dtos';

interface GreetingProps {
  deckStats: DeckStats | undefined;
  reviewPace: ReviewPace | undefined;
}

export function Greeting({ deckStats, reviewPace }: GreetingProps) {
  const settings = useQuery<UserSettings>({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const r = await fetch('/api/settings');
      if (!r.ok) throw new Error(`settings: ${r.status}`);
      return r.json() as Promise<UserSettings>;
    },
  });

  const hour = new Date().getHours();
  const name = settings.data?.displayName;
  const avatar = settings.data?.avatar;
  const greeting =
    hour >= 2 && hour < 12
      ? 'Good morning'
      : hour >= 12 && hour < 18
        ? 'Good afternoon'
        : 'Good evening';

  const now = new Date();
  const weekday = now
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toUpperCase();
  const month = now
    .toLocaleDateString('en-US', { month: 'long' })
    .toUpperCase();
  const day = now.getDate();

  const decksWithDue =
    deckStats?.decks.filter(
      (d) => d.newCount + d.learnCount + d.reviewCount > 0
    ).length ?? 0;

  const totalDue = reviewPace?.totalDue ?? 0;
  const estimatedMinutes =
    reviewPace && reviewPace.totalDue > 0
      ? Math.max(
          1,
          Math.round((reviewPace.medianMs * reviewPace.totalDue) / 60000)
        )
      : 0;

  return (
    <div className="space-y-2">
      <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-ink-300">
        {weekday} · {month} {day}
      </p>
      <div className="flex items-center gap-4">
        {avatar && (
          <div className="flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-full border-2 border-milk-300/60 bg-milk-100 overflow-hidden">
            <img src={avatar} alt="Avatar" className="size-full object-cover" />
          </div>
        )}
        <h1 className="font-display text-4xl sm:text-5xl font-bold italic text-mint-700 tracking-tight">
          {greeting}
          {name ? `, ${name}` : ''}.
        </h1>
      </div>
      {totalDue > 0 ? (
        <p className="text-[15px] text-ink-500">
          You have{' '}
          <span className="font-bold text-ink-900">{totalDue} cards</span> due
          across {decksWithDue} deck{decksWithDue !== 1 ? 's' : ''}.
          {estimatedMinutes > 0 && (
            <>
              {' '}
              Roughly{' '}
              <span className="font-bold text-ink-900">
                {estimatedMinutes} minutes
              </span>{' '}
              if you keep your pace.
            </>
          )}
        </p>
      ) : (
        <p className="text-[15px] text-ink-500">You&apos;re all caught up.</p>
      )}
    </div>
  );
}
