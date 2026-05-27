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
        <div className="h-2 overflow-hidden rounded-full bg-milk-400/60">
          <div
            className="h-full rounded-full bg-mint-500 transition-all duration-500 ease-out"
            style={{ width: `${total > 0 ? (reviewed / total) * 100 : 0}%` }}
          />
        </div>
      ) : (
        <div className="flex gap-1">
          {Array.from({ length: total }, (_, i) => {
            const isFilled = i < reviewed;
            const isCurrent = i === reviewed;
            return (
              <div
                key={i}
                className={`h-2 flex-1 rounded-sm transition-colors duration-300 ${
                  isFilled
                    ? 'bg-mint-500'
                    : isCurrent
                      ? 'bg-mint-300'
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
