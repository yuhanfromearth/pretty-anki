import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar } from 'lucide-react';

interface AnswerBarProps {
  visible: boolean;
  buttons: number[];
  nextReviews: string[];
  onAnswer: (ease: number, index: number) => void;
  onReschedule: (days: number) => void;
}

const EASE_CONFIG: Record<
  number,
  { label: string; bg: string; border: string; accent: string }
> = {
  1: {
    label: 'Again',
    bg: 'bg-terra/15 dark:bg-terra/12',
    border: 'border-terra/30',
    accent: 'text-terra dark:text-terra',
  },
  2: {
    label: 'Hard',
    bg: 'bg-apricot/15 dark:bg-apricot/12',
    border: 'border-apricot/30',
    accent: 'text-[#a07030] dark:text-apricot',
  },
  3: {
    label: 'Good',
    bg: 'bg-mint-500/15 dark:bg-mint-500/12',
    border: 'border-mint-500/30 dark:border-mint-300/40',
    accent: 'text-mint-700 dark:text-mint-300',
  },
  4: {
    label: 'Easy',
    bg: 'bg-sky/15 dark:bg-sky/12',
    border: 'border-sky/30',
    accent: 'text-[#3d7a9a] dark:text-sky',
  },
};

export function AnswerBar({
  visible,
  buttons,
  nextReviews,
  onAnswer,
  onReschedule,
}: AnswerBarProps) {
  const [customDays, setCustomDays] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleReschedule = () => {
    const days = parseInt(customDays, 10);
    if (days > 0) {
      onReschedule(days);
      setCustomDays('');
      setShowCustom(false);
    }
  };

  return (
    <AnimatePresence
      onExitComplete={() => {
        setShowCustom(false);
        setCustomDays('');
      }}
    >
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="w-full space-y-4"
        >
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-300">
            how well did you remember?
          </p>

          <div className="grid grid-cols-4 gap-2">
            {buttons.map((ease, i) => {
              const config = EASE_CONFIG[ease];
              if (!config) return null;
              const nextReview = nextReviews[i] ?? '';
              return (
                <motion.button
                  key={ease}
                  onClick={() => onAnswer(ease, i)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className={`cursor-pointer rounded-2xl border px-4 py-3 text-left transition-colors ${config.bg} ${config.border}`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`text-sm font-semibold ${config.accent}`}>
                      {config.label}
                    </span>
                    <span className="flex size-5 items-center justify-center rounded-full bg-milk-300/50 font-mono text-[10px] text-ink-300">
                      {ease}
                    </span>
                  </div>
                  {nextReview && (
                    <p className="mt-2 text-[11px] text-ink-500">
                      next in{' '}
                      <span className="font-semibold text-ink-700">
                        {nextReview}
                      </span>
                    </p>
                  )}
                </motion.button>
              );
            })}
          </div>

          <div className="flex h-8 items-center justify-center pt-1">
            {!showCustom ? (
              <button
                onClick={() => setShowCustom(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink-300 transition-colors hover:text-ink-500"
              >
                <Calendar className="size-3" />
                custom interval
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-milk-200/60 bg-milk-50/90 px-3 py-1.5">
                  <input
                    type="number"
                    min={1}
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleReschedule()}
                    placeholder="7"
                    className="w-12 bg-transparent text-center font-mono text-sm text-ink-900 outline-none placeholder:text-ink-100"
                    autoFocus
                  />
                  <span className="text-xs text-ink-300">days</span>
                </div>
                <button
                  onClick={handleReschedule}
                  disabled={!customDays || parseInt(customDays, 10) < 1}
                  className="cursor-pointer rounded-full bg-mint-500 px-4 py-1.5 text-xs font-medium text-white shadow-soft transition-colors hover:bg-mint-700 disabled:opacity-40 dark:text-cocoa-950"
                >
                  Schedule
                </button>
                <button
                  onClick={() => {
                    setShowCustom(false);
                    setCustomDays('');
                  }}
                  className="cursor-pointer text-xs text-ink-300 transition-colors hover:text-ink-500"
                >
                  cancel
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
