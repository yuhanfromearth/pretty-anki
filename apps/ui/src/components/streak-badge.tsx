import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

// A soft warm sweep with one cool accent, repeated at the seam so the rotation
// is seamless. Kept muted and low-contrast so the ring reads as a subtle shimmer
// rather than a full rainbow.
const RAINBOW =
  'conic-gradient(from 0deg, #ffb14e, #ffd98a, #ffe9c2, #b9d4ff, #ffd98a, #ffb14e)';

/**
 * The header streak count. When the user hasn't reviewed today
 * (`reviewedToday` false) the badge sits in a muted "frozen" state; the first
 * review of the day flips it to the warm active palette and rolls the number
 * from x to x+1.
 *
 * Color is switched via Tailwind + CSS `transition-colors` (so it tracks the
 * theme), while the odometer roll uses `motion` for transform/opacity only —
 * never color, which would force motion to interpolate oklch.
 *
 * On an actual increase (days went up since the last render, not on first
 * mount), a rainbow ring sweeps around the badge for a short celebratory
 * moment. The ring is a rotating conic-gradient sibling sitting just behind the
 * badge, so only the thin rim around the circle shows through.
 */
export function StreakBadge({
  days,
  reviewedToday,
}: {
  days: number;
  reviewedToday: boolean;
}) {
  const reducedMotion = useReducedMotion();

  const prevDays = useRef(days);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    const increased = days > prevDays.current;
    prevDays.current = days;
    if (!increased || reducedMotion) return;
    setCelebrating(true);
    const timer = setTimeout(() => setCelebrating(false), 1100);
    return () => clearTimeout(timer);
  }, [days, reducedMotion]);

  return (
    <span className="flex items-center gap-1.5">
      <span className="relative inline-flex">
        <AnimatePresence>
          {celebrating && (
            <motion.span
              key="rainbow"
              aria-hidden
              className="pointer-events-none absolute -inset-[2.5px] rounded-full"
              style={{ background: RAINBOW }}
              initial={{ opacity: 0, rotate: 0, scale: 0.85 }}
              animate={{ opacity: 0.7, rotate: 360, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                rotate: {
                  duration: 0.55,
                  ease: 'linear',
                  repeat: Number.POSITIVE_INFINITY,
                },
                opacity: { duration: 0.2 },
                scale: { type: 'spring', stiffness: 420, damping: 28 },
              }}
            />
          )}
        </AnimatePresence>
        <span
          className={`relative flex size-5.5 items-center justify-center overflow-hidden rounded-full font-display text-[11px] font-semibold transition-colors duration-500 ${
            reviewedToday
              ? 'bg-milk-400/60 text-ink-700'
              : 'bg-milk-300/50 text-ink-300'
          }`}
        >
          {reducedMotion ? (
            <span>{days}</span>
          ) : (
            <AnimatePresence initial={false}>
              <motion.span
                key={days}
                className="absolute inset-0 flex items-center justify-center"
                initial={{ y: '120%', opacity: 0 }}
                animate={{ y: '0%', opacity: 1, scale: [0.7, 1.15, 1] }}
                exit={{ y: '-120%', opacity: 0 }}
                transition={{
                  y: { type: 'spring', stiffness: 420, damping: 32 },
                  opacity: { duration: 0.2 },
                  scale: { duration: 0.4, times: [0, 0.6, 1] },
                }}
              >
                {days}
              </motion.span>
            </AnimatePresence>
          )}
        </span>
      </span>
      <span
        className={`transition-colors duration-500 ${
          reviewedToday ? 'text-ink-700' : 'text-ink-300'
        }`}
      >
        day streak
      </span>
    </span>
  );
}
