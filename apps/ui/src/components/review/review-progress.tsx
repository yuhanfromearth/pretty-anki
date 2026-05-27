interface ReviewProgressProps {
  reviewed: number;
  total: number;
  medianMs?: number;
}

export function ReviewProgress({
  reviewed,
  total,
  medianMs,
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
                      ? 'bg-mint-600 dark:bg-mint-400'
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
        <p className="text-xs text-ink-500">
          <span className="font-semibold text-ink-700">{reviewed}</span>{' '}
          reviewed <span className="text-ink-300">&middot;</span>{' '}
          <span className="font-semibold text-ink-700">{remaining}</span> to go
        </p>
        {estMinutes !== null && (
          <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-ink-300">
            est. {estMinutes} min
          </p>
        )}
      </div>
    </div>
  );
}
