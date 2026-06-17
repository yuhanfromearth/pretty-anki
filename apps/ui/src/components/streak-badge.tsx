import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

/**
 * The header streak count. When the user hasn't reviewed today
 * (`reviewedToday` false) the badge sits in a muted "frozen" state; the first
 * review of the day flips it to the warm active palette and rolls the number
 * from x to x+1.
 *
 * Color is switched via Tailwind + CSS `transition-colors` (so it tracks the
 * theme), while the odometer roll uses `motion` for transform/opacity only —
 * never color, which would force motion to interpolate oklch.
 */
export function StreakBadge({
  days,
  reviewedToday,
}: {
  days: number;
  reviewedToday: boolean;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <span className="flex items-center gap-1.5">
      <span className="relative inline-flex">
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
