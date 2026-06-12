import { ChevronDown, ChevronUp, Code2, Plus, Trash2 } from 'lucide-react';
import type { Block, Role } from '@nts/shared';
import { RoleSchema } from '@nts/shared';
import { Button } from '#/components/ui/button';

const ROLES = RoleSchema.options as readonly Role[];

const selectCls =
  'h-7 min-w-0 flex-1 rounded-md border border-milk-300/80 bg-milk-50 px-1.5 text-xs text-ink-700 outline-none focus-visible:border-ring';

/** Editor for one side's ordered block stack: each row binds a field to a role
 *  (or a raw HTML override), with reorder/remove and an add control. Reordering
 *  uses up/down buttons rather than drag for predictability. */
export function BlockStack({
  label,
  blocks,
  fields,
  onChange,
}: {
  label: string;
  blocks: Block[];
  fields: string[];
  onChange: (blocks: Block[]) => void;
}) {
  const update = (id: string, patch: Partial<Block>) =>
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id));

  const move = (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= blocks.length) return;
    const copy = [...blocks];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    onChange(copy);
  };

  const add = () =>
    onChange([
      ...blocks,
      {
        id: crypto.randomUUID(),
        field: fields[0] ?? '',
        role: 'body',
      },
    ]);

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-300">
        {label}
      </span>

      <div className="flex flex-col gap-2">
        {blocks.map((block, i) => (
          <div
            key={block.id}
            className="rounded-xl border border-milk-200/70 bg-milk-50/70 p-2.5"
          >
            <div className="flex items-center gap-1.5">
              <div className="flex shrink-0 flex-col">
                <button
                  className="flex size-4 items-center justify-center text-ink-300 hover:text-ink-600 disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="Move up"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  className="flex size-4 items-center justify-center text-ink-300 hover:text-ink-600 disabled:opacity-30"
                  disabled={i === blocks.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Move down"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>

              <select
                className={selectCls}
                value={block.field}
                onChange={(e) => update(block.id, { field: e.target.value })}
              >
                {fields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>

              <select
                className={selectCls}
                value={block.role}
                disabled={block.raw !== undefined}
                onChange={(e) =>
                  update(block.id, { role: e.target.value as Role })
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  size="icon-xs"
                  variant={block.raw !== undefined ? 'secondary' : 'ghost'}
                  title="Raw HTML override"
                  onClick={() =>
                    update(block.id, {
                      raw: block.raw === undefined ? '{{value}}' : undefined,
                    })
                  }
                >
                  <Code2 />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  title="Remove block"
                  onClick={() => remove(block.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>

            {block.raw !== undefined && (
              <textarea
                className="mt-2 h-20 w-full resize-y rounded-md border border-milk-300/80 bg-milk-50 p-2 font-mono text-xs text-ink-700 outline-none focus-visible:border-ring"
                value={block.raw}
                spellCheck={false}
                onChange={(e) => update(block.id, { raw: e.target.value })}
                placeholder="HTML — use {{value}} for the field value"
              />
            )}
          </div>
        ))}
      </div>

      <Button
        size="sm"
        variant="ghost"
        className="self-start text-ink-400"
        onClick={add}
        disabled={fields.length === 0}
      >
        <Plus /> Add block
      </Button>
    </div>
  );
}
