import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { ChevronsUpDown } from 'lucide-react';
import type { ModelDto } from '@nts/shared';

interface ModelPickerProps {
  value: string;
  onChange: (modelId: string) => void;
  /** Shown when nothing is picked yet (e.g. the default model id). */
  placeholder?: string;
}

function formatPrice(perToken: string): string {
  const usd = parseFloat(perToken) * 1_000_000;
  return `$${usd.toFixed(2)}/M`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}

function isFree(model: ModelDto): boolean {
  return model.pricing.prompt === '0' && model.pricing.completion === '0';
}

export function ModelPicker({
  value,
  onChange,
  placeholder,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [debouncedQuery, setDebouncedQuery] = useState(value);
  const [freeOnly, setFreeOnly] = useState(false);

  // Keep the field text in sync if the saved model changes from outside.
  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: models } = useQuery<ModelDto[]>({
    queryKey: ['models', debouncedQuery, freeOnly],
    queryFn: () => {
      const params = new URLSearchParams({
        search: debouncedQuery,
        limit: '20',
      });
      if (freeOnly) params.set('free', 'true');
      return fetch(`/api/models?${params.toString()}`).then((r) => {
        if (!r.ok) throw new Error(`models: ${r.status}`);
        return r.json() as Promise<ModelDto[]>;
      });
    },
    enabled: open,
  });

  const items = models ?? [];

  return (
    <Autocomplete.Root
      items={items}
      // Items are filtered on the server, so disable the built-in filtering.
      mode="none"
      value={query}
      onValueChange={setQuery}
      open={open}
      onOpenChange={setOpen}
      openOnInputClick
      itemToStringValue={(m: ModelDto) => m.id}
    >
      <div className="relative">
        <Autocomplete.Input
          placeholder={placeholder}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 font-mono text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-ink-300" />
      </div>
      <Autocomplete.Portal>
        <Autocomplete.Positioner
          align="start"
          sideOffset={6}
          className="isolate z-50"
        >
          <Autocomplete.Popup className="flex max-h-72 w-(--anchor-width) origin-(--transform-origin) flex-col rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="font-mono text-[10px] font-semibold tracking-[0.15em] text-ink-300 uppercase">
                Models
              </span>
              <button
                type="button"
                aria-pressed={freeOnly}
                onClick={() => setFreeOnly((v) => !v)}
                className={`rounded-md border px-2 py-0.5 text-[10px] transition-colors ${
                  freeOnly
                    ? 'border-transparent bg-mint-500 text-white'
                    : 'border-milk-300 text-ink-400 hover:text-ink-600'
                }`}
              >
                Free
              </button>
            </div>
            <Autocomplete.Empty className="px-2 py-2 text-xs text-ink-400 empty:m-0 empty:p-0">
              {freeOnly ? 'No free models match.' : 'No models found.'}
            </Autocomplete.Empty>
            <Autocomplete.List className="flex flex-col gap-0.5 overflow-y-auto overscroll-contain scrollbar-hide">
              {(model: ModelDto) => (
                <Autocomplete.Item
                  key={model.id}
                  value={model}
                  onClick={() => {
                    onChange(model.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer rounded-md px-2 py-1.5 transition-colors data-highlighted:bg-milk-100 data-[selected]:bg-mint-50"
                >
                  <div className="truncate text-sm font-medium text-ink-800">
                    {model.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-ink-400">
                    <span className="min-w-0 flex-1 truncate">
                      {formatTokens(model.contextLength)} ctx
                    </span>
                    {isFree(model) ? (
                      <span className="shrink-0 font-semibold text-mint-600">
                        free
                      </span>
                    ) : (
                      <span className="flex shrink-0 gap-2 font-semibold">
                        <span className="text-mint-600">
                          in {formatPrice(model.pricing.prompt)}
                        </span>
                        <span className="text-ink-500">
                          out {formatPrice(model.pricing.completion)}
                        </span>
                      </span>
                    )}
                  </div>
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
