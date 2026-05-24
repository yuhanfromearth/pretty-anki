import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Sun, Moon, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Streak } from '@nts/dtos';

export function Header() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const streak = useQuery<Streak>({
    queryKey: ['streak'],
    queryFn: async () => {
      const r = await fetch('/api/anki/streak');
      if (!r.ok) throw new Error(`streak: ${r.status}`);
      return r.json() as Promise<Streak>;
    },
    retry: false,
  });

  return (
    <header className="sticky top-0 z-50 w-full max-w-6xl mx-auto shrink-0 px-5 sm:px-8 pt-6 pb-4">
      <div className="flex h-12 items-center rounded-2xl bg-milk-50/90 backdrop-blur-sm border border-milk-300/40 px-5 shadow-soft">
        <nav className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-mint-500 shadow-[0_0_0_4px_var(--color-mint-100)]" />
            <span className="font-display text-base font-medium tracking-tight text-ink-900">
              pretty&#8209;anki
            </span>
          </Link>
          <span className="text-milk-300">|</span>
          <span className="text-xs font-medium text-ink-300">home</span>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {streak.data && (
            <div className="mr-2 flex items-center gap-1.5 rounded-full bg-milk-200/60 border border-milk-300/50 pl-0.5 pr-2.5 py-0.5 text-xs font-medium">
              <span className="flex size-5.5 items-center justify-center rounded-full bg-milk-400/60 font-display text-[11px] font-semibold text-ink-700">
                {streak.data.days}
              </span>
              <span className="text-ink-700">day streak</span>
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="flex size-8 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-milk-100 hover:text-ink-500"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button className="flex size-8 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-milk-100 hover:text-ink-500">
            <Settings className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
