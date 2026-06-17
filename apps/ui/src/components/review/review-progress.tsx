import type { QueueCounts } from '@nts/shared';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip';

interface ReviewProgressProps {
  reviewed: number;
  total: number;
  medianMs?: number;
  // Live composition of the remaining queue, shown on hover so the "to go"
  // count reveals how much is new vs. learning vs. review.
  queueCounts?: QueueCounts | null;
}

const QUEUE_ROWS: {
  key: keyof QueueCounts;
  label: string;
  hint: string;
  dot: string;
  text: string;
}[] = [
  {
    key: 'newCount',
    label: 'New',
    hint: "Cards you haven't studied yet",
    dot: 'bg-sky',
    text: 'text-sky',
  },
  {
    key: 'learnCount',
    label: 'Learning',
    hint: 'Recently introduced, still in short steps',
    dot: 'bg-terra',
    text: 'text-terra',
  },
  {
    key: 'reviewCount',
    label: 'Review',
    hint: 'Learned cards due again today',
    dot: 'bg-mint-500',
    text: 'text-mint-500',
  },
];

export function ReviewProgress({
  reviewed,
  total,
  medianMs,
  queueCounts,
}: ReviewProgressProps) {
  const remaining = Math.max(0, total - reviewed);

  const estMinutes =
    medianMs && remaining > 0
      ? Math.max(1, Math.round((remaining * medianMs) / 60_000))
      : null;

  return (
    <div className="space-y-2">
      {total > 150 ? (
        <div className="relative h-2 overflow-hidden rounded-full bg-milk-400/60">
          <div
            className="h-full rounded-full bg-mint-500 transition-all duration-500 ease-out"
            style={{ width: `${total > 0 ? (reviewed / total) * 100 : 0}%` }}
          />
          {total > 10 &&
            Array.from({ length: Math.floor((total - 1) / 5) }, (_, i) => {
              const pos = (((i + 1) * 5) / total) * 100;
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full w-px bg-black/10 dark:bg-white/15"
                  style={{ left: `${pos}%` }}
                />
              );
            })}
        </div>
      ) : (
        <div className={`flex gap-1 ${total > 10 ? 'items-end' : ''}`}>
          {Array.from({ length: total }, (_, i) => {
            const isFilled = i < reviewed;
            const isCurrent = i === reviewed;
            const isFifth = total > 10 && (i + 1) % 5 === 0;
            return (
              <div
                key={i}
                className={`${isFifth ? 'h-3' : 'h-2'} flex-1 rounded-sm transition-colors duration-300 ${
                  isFilled
                    ? isFifth
                      ? 'bg-mint-700 dark:bg-mint-300'
                      : 'bg-mint-500'
                    : isCurrent
                      ? 'bg-mint-300'
                      : isFifth
                        ? 'bg-milk-500/60 dark:bg-milk-300/60'
                        : 'bg-milk-400/60'
                }`}
              />
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-between">
        <Tooltip delay={150}>
          <TooltipTrigger
            render={
              <p className="cursor-default text-xs text-ink-500 underline decoration-ink-100 decoration-dotted underline-offset-4 transition-colors hover:decoration-ink-300" />
            }
          >
            <span className="font-semibold text-ink-700">{reviewed}</span>{' '}
            reviewed <span className="text-ink-300">&middot;</span>{' '}
            <span className="font-semibold text-ink-700">{remaining}</span> to
            go
          </TooltipTrigger>
          <TooltipContent className="w-60">
            <div className="flex flex-col gap-2.5">
              <p className="font-mono text-[10px] font-medium uppercase tracking-wide text-ink-300">
                Remaining
              </p>
              {QUEUE_ROWS.map(({ key, label, hint, dot, text }) => (
                <div key={key} className="flex items-start gap-2">
                  <span
                    className={`mt-1 size-2 shrink-0 rounded-full ${dot}`}
                  />
                  <div className="flex flex-1 items-center gap-2">
                    <div className="flex-1">
                      <span className="text-xs font-medium text-ink-700">
                        {label}
                      </span>
                      <p className="text-[11px] leading-snug text-ink-400">
                        {hint}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${text}`}
                    >
                      {queueCounts ? queueCounts[key] : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
        {estMinutes !== null && (
          <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-ink-300">
            est. {estMinutes} min
          </p>
        )}
      </div>
    </div>
  );
}
