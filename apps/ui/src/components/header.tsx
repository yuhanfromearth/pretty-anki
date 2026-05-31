import { Link, useMatches } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Sun, Moon, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Streak } from '@nts/shared';
import { SettingsDialog } from '#/components/settings-dialog';
import { StreakHeatmap } from '#/components/streak-heatmap';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover';

function Breadcrumb() {
  const matches = useMatches();
  const segments: string[] = [];
  for (const m of matches) {
    if (m.routeId === '__root__' || m.routeId === '/') continue;
    const parts = m.routeId.split('/').filter(Boolean);
    for (const part of parts) {
      if (part.startsWith('$')) {
        const paramName = part.slice(1);
        const value = (m.params as Record<string, string>)[paramName];
        if (value) segments.push(decodeURIComponent(value));
      } else {
        segments.push(part);
      }
    }
  }
  if (segments.length === 0) {
    return <span className="text-xs font-medium text-ink-300">home</span>;
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-ink-300 truncate max-w-60">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-milk-300">&gt;</span>}
          <span>{seg}</span>
        </span>
      ))}
    </span>
  );
}

export function Header() {
  const [dark, setDark] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    const next = !dark;
    const apply = () => {
      setDark(next);
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('theme', next ? 'dark' : 'light');
    };

    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void> };
    };
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (!doc.startViewTransition || prefersReducedMotion) {
      apply();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = doc.startViewTransition(apply);
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 500,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  };

  const health = useQuery<{ connected: boolean }>({
    queryKey: ['anki-health'],
    queryFn: async () => {
      const r = await fetch('/api/anki/health');
      if (!r.ok) return { connected: false };
      return r.json() as Promise<{ connected: boolean }>;
    },
    refetchInterval: 15_000,
    retry: false,
  });

  const connected = health.data?.connected ?? false;

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
            <span className="relative inline-flex size-5 items-center justify-center">
              <AnimatePresence>
                {connected && (
                  <motion.span
                    key="ping"
                    className="absolute rounded-full"
                    style={{
                      width: 8,
                      height: 8,
                      backgroundColor: '#9ec5ad',
                    }}
                    animate={{
                      scale: [1, 3.5, 1],
                      opacity: [0.6, 0, 0],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: 'easeOut',
                      times: [0, 0.8, 1],
                    }}
                  />
                )}
              </AnimatePresence>
              <span
                className={`relative inline-flex size-2 rounded-full ${
                  connected
                    ? 'bg-mint-500 shadow-[0_0_0_4px_var(--color-mint-100)]'
                    : 'bg-rose-300/70 shadow-[0_0_0_4px_rgba(244,204,204,0.4)]'
                }`}
              />
            </span>
            <span className="font-display text-base font-medium tracking-tight text-ink-900">
              pretty&#8209;anki
            </span>
          </Link>
          <span className="text-milk-300">|</span>
          <Breadcrumb />
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {streak.data && (
            <Popover>
              <PopoverTrigger
                openOnHover
                delay={150}
                closeDelay={200}
                className="mr-2 flex items-center gap-1.5 rounded-full bg-milk-200/60 border border-milk-300/50 pl-0.5 pr-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-milk-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-300"
              >
                <span className="flex size-5.5 items-center justify-center rounded-full bg-milk-400/60 font-display text-[11px] font-semibold text-ink-700">
                  {streak.data.days}
                </span>
                <span className="text-ink-700">day streak</span>
              </PopoverTrigger>
              <PopoverContent
                backdrop
                side="bottom"
                align="end"
                sideOffset={8}
                className="w-auto rounded-2xl border border-milk-300/40 bg-milk-50 p-4 shadow-soft ring-0"
              >
                <StreakHeatmap streak={streak.data} />
              </PopoverContent>
            </Popover>
          )}
          <button
            onClick={toggleTheme}
            className="flex size-8 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-milk-100 hover:text-ink-500"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex size-8 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-milk-100 hover:text-ink-500"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}
