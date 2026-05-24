import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

export const Route = createFileRoute('/')({ component: DecksPage });

function DecksPage() {
  const {
    data: decks,
    isPending,
    error,
  } = useQuery<string[]>({
    queryKey: ['decks'],
    queryFn: async () => {
      const r = await fetch('/api/anki/decks');
      if (!r.ok) throw new Error('Failed to fetch decks');
      const data: unknown = await r.json();
      if (!Array.isArray(data)) throw new Error('Anki is not reachable');
      return data as string[];
    },
    retry: false,
  });

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="space-y-1 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block size-2 rounded-full bg-mint-500 shadow-[0_0_0_4px_var(--color-mint-100)]" />
          <span className="font-display text-lg font-medium tracking-tight text-ink-900">
            pretty anki
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
          {greeting}
        </h1>
        <p className="text-ink-500 text-[15px]">Let's start.</p>
      </header>

      {/* Deck list */}
      <section className="space-y-3">
        <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-ink-300">
          Your decks
        </span>

        {isPending && (
          <div className="flex items-center gap-3 py-8 text-ink-300 text-sm">
            <span className="size-4 rounded-full border-2 border-ink-100 border-t-mint-500 animate-spin" />
            Loading decks...
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-terra/10 border border-terra/30 px-4 py-3 text-sm text-terra">
            Could not connect to Anki. Make sure Anki is running with
            AnkiConnect enabled.
          </div>
        )}

        {decks && decks.length === 0 && (
          <div className="rounded-xl bg-milk-100 border border-milk-300 px-4 py-6 text-center text-sm text-ink-500">
            No decks found. Create a deck in Anki to get started.
          </div>
        )}

        <div className="grid gap-2">
          {decks?.map((name) => (
            <button
              key={name}
              className="group flex items-center gap-4 rounded-2xl bg-milk-100/60 backdrop-blur-sm border border-white/55 px-5 py-4 text-left shadow-soft transition-all hover:bg-milk-200 hover:shadow-medium active:scale-[0.995]"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-50 text-mint-700 border border-mint-100 text-sm font-semibold">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink-900 truncate">
                  {name}
                </div>
              </div>
              <svg
                className="size-4 text-ink-100 transition-colors group-hover:text-ink-300"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
