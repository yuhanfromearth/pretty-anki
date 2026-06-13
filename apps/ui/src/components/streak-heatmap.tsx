import { useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { Streak, StreakDay } from '@nts/shared';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// count -> ramp level: 0 = empty, 1..10 increasing volume (top bucket 150+).
function level(count: number): number {
  if (count <= 0) return 0;
  if (count < 15) return 1;
  if (count < 30) return 2;
  if (count < 45) return 3;
  if (count < 60) return 4;
  if (count < 75) return 5;
  if (count < 90) return 6;
  if (count < 105) return 7;
  if (count < 130) return 8;
  if (count < 150) return 9;
  return 10;
}

function formatDay(day: StreakDay): string {
  const [, m, d] = day.date.split('-').map(Number);
  const label = `${MONTHS[m - 1]} ${d}`;
  const reviews =
    day.count === 0
      ? 'no reviews'
      : `${day.count} review${day.count === 1 ? '' : 's'}`;
  return `${label} · ${reviews}`;
}

export function StreakHeatmap({ streak }: { streak: Streak }) {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState<StreakDay | null>(null);

  const { days, reviewedToday, history } = streak;
  const todayStr = history.length > 0 ? history[history.length - 1].date : '';

  const headline =
    days === 0
      ? `${days} day streak :(`
      : reviewedToday
        ? `🌸 ${days} day streak`
        : `🌸 ${days} day streak · review to keep it`;

  // history is dense and Monday-aligned from the backend, so chunking by 7
  // yields columns of Mon..Sun. Only the last column may be partial (future
  // days of the current week are left blank).
  const columns: StreakDay[][] = [];
  for (let i = 0; i < history.length; i += 7) {
    columns.push(history.slice(i, i + 7));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span
          className={`font-display text-base font-semibold ${
            reviewedToday ? 'text-ink-900' : 'text-ink-500'
          }`}
        >
          {headline}
        </span>
        <span className="h-4 font-mono text-xs leading-4 text-ink-300">
          {hovered ? formatDay(hovered) : 'Last 6 months'}
        </span>
      </div>

      {/* Month labels: one slot per column, label sits above its first month. */}
      <div className="flex gap-1 pl-px">
        {columns.map((col, colIndex) => {
          const firstMonth = Number(col[0].date.split('-')[1]) - 1;
          const prevMonth =
            colIndex > 0
              ? Number(columns[colIndex - 1][0].date.split('-')[1]) - 1
              : -1;
          const showLabel = firstMonth !== prevMonth;
          return (
            <div key={colIndex} className="relative h-3.5 w-3.5">
              {showLabel && (
                <span className="absolute left-0 top-0 font-mono text-[11px] leading-3.5 text-ink-300 whitespace-nowrap">
                  {MONTHS[firstMonth]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-1">
        {columns.map((col, colIndex) => (
          <div key={colIndex} className="flex flex-col gap-1">
            {Array.from({ length: 7 }, (_, row) => {
              const day = col[row];
              if (!day) {
                return <div key={row} className="size-3.5" />;
              }
              const isToday = day.date === todayStr;
              const style: React.CSSProperties = {
                backgroundColor: `var(--heat-${level(day.count)})`,
              };
              if (!reducedMotion) {
                style.animation = `heat-cell-in 180ms ease-out ${colIndex * 12}ms both`;
              }
              return (
                <div
                  key={row}
                  className={`size-3.5 rounded-[3px] ${
                    isToday ? 'ring-1 ring-ink-700/40' : ''
                  }`}
                  style={style}
                  onMouseEnter={() => setHovered(day)}
                  onMouseLeave={() =>
                    setHovered((cur) => (cur === day ? null : cur))
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
