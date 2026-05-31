import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  Plus,
} from 'lucide-react';
import type { DeckStats, DeckStatsItem } from '@nts/shared';
import { DeckRow } from './deck-row';
import { CreateDeckDialog } from './create-deck-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover';

type SortKey =
  | 'reviews-desc'
  | 'reviews-asc'
  | 'mastery-desc'
  | 'mastery-asc'
  | 'alpha-asc'
  | 'alpha-desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'reviews-desc', label: 'Reviews: high → low' },
  { key: 'reviews-asc', label: 'Reviews: low → high' },
  { key: 'mastery-desc', label: 'Mastery: high → low' },
  { key: 'mastery-asc', label: 'Mastery: low → high' },
  { key: 'alpha-asc', label: 'Name: A → Z' },
  { key: 'alpha-desc', label: 'Name: Z → A' },
];

const SORT_STORAGE_KEY = 'deck-list:sort';
const DEFAULT_SORT: SortKey = 'reviews-desc';

function isSortKey(value: string): value is SortKey {
  return SORT_OPTIONS.some((o) => o.key === value);
}

function getDueCount(deck: DeckStatsItem) {
  return deck.newCount + deck.learnCount + deck.reviewCount;
}

function getMastery(deck: DeckStatsItem) {
  return deck.totalCards > 0 ? deck.matureCards / deck.totalCards : 0;
}

function getCompareFn(
  key: SortKey
): (a: DeckStatsItem, b: DeckStatsItem) => number {
  const [field, dir] = key.split('-') as [string, string];
  const mult = dir === 'desc' ? -1 : 1;

  if (field === 'alpha') {
    return (a, b) => mult * a.name.localeCompare(b.name);
  }

  const getValue = field === 'reviews' ? getDueCount : getMastery;
  return (a, b) => mult * (getValue(a) - getValue(b));
}

interface DeckNode {
  segment: string;
  fullName: string;
  deck: DeckStatsItem | null;
  children: DeckNode[];
}

function buildDeckTree(decks: DeckStatsItem[]): DeckNode[] {
  const root: DeckNode[] = [];
  const nodeMap = new Map<string, DeckNode>();

  for (const deck of decks) {
    const parts = deck.name.split('::');
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const fullName = parts.slice(0, i + 1).join('::');
      let node = nodeMap.get(fullName);

      if (!node) {
        node = { segment: parts[i], fullName, deck: null, children: [] };
        nodeMap.set(fullName, node);
        currentLevel.push(node);
      }

      if (i === parts.length - 1) {
        node.deck = deck;
      }

      currentLevel = node.children;
    }
  }

  return root;
}

interface FlatDeckEntry {
  deck: DeckStatsItem;
  displayName: string;
  depth: number;
  hasChildren: boolean;
  subDeckCount: number;
}

function countDescendantDecks(node: DeckNode): number {
  let count = 0;
  for (const child of node.children) {
    if (child.deck) count++;
    count += countDescendantDecks(child);
  }
  return count;
}

function flattenDeckTree(
  nodes: DeckNode[],
  compareFn: (a: DeckStatsItem, b: DeckStatsItem) => number,
  collapsed: ReadonlySet<string>,
  depth = 0
): FlatDeckEntry[] {
  const sorted = [...nodes].sort((a, b) => {
    if (a.deck && b.deck) return compareFn(a.deck, b.deck);
    return a.segment.localeCompare(b.segment);
  });

  const result: FlatDeckEntry[] = [];
  for (const node of sorted) {
    const hasChildren = node.children.length > 0;
    if (node.deck) {
      result.push({
        deck: node.deck,
        displayName: node.segment,
        depth,
        hasChildren,
        subDeckCount: countDescendantDecks(node),
      });
    }
    if (hasChildren && !collapsed.has(node.fullName)) {
      result.push(
        ...flattenDeckTree(
          node.children,
          compareFn,
          collapsed,
          node.deck ? depth + 1 : depth
        )
      );
    }
  }
  return result;
}

interface DeckListProps {
  deckStats: DeckStats;
  selectedDeck: string | null;
  onSelectDeck?: (name: string) => void;
}

export function DeckList({
  deckStats,
  selectedDeck,
  onSelectDeck,
}: DeckListProps) {
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    if (typeof window === 'undefined') return DEFAULT_SORT;
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    return stored && isSortKey(stored) ? stored : DEFAULT_SORT;
  });

  useEffect(() => {
    localStorage.setItem(SORT_STORAGE_KEY, sortKey);
  }, [sortKey]);

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const flatEntries = useMemo(() => {
    const tree = buildDeckTree(deckStats.decks);
    return flattenDeckTree(tree, getCompareFn(sortKey), collapsed);
  }, [deckStats.decks, sortKey, collapsed]);

  const toggleCollapse = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const activeLabel = SORT_OPTIONS.find((o) => o.key === sortKey)!.label;
  const SortIcon = sortKey.endsWith('-desc')
    ? ArrowDownWideNarrow
    : ArrowUpNarrowWide;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-ink-300">
          all decks
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-semibold tracking-wide uppercase text-ink-300 transition-colors hover:text-ink-500">
            <SortIcon className="size-3" />
            {activeLabel}
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={6} className="w-48 p-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  setSortKey(opt.key);
                  setOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-ink-700 transition-colors hover:bg-milk-200"
              >
                <Check
                  className={`size-3 ${opt.key === sortKey ? 'opacity-100' : 'opacity-0'}`}
                />
                {opt.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {flatEntries.map((entry) => (
              <motion.div
                key={entry.deck.name}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  layout: { type: 'spring', stiffness: 400, damping: 30 },
                  opacity: { duration: 0.15 },
                }}
              >
                <DeckRow
                  deck={entry.deck}
                  displayName={entry.displayName}
                  depth={entry.depth}
                  hasChildren={entry.hasChildren}
                  subDeckCount={entry.subDeckCount}
                  isCollapsed={collapsed.has(entry.deck.name)}
                  onToggleCollapse={() => toggleCollapse(entry.deck.name)}
                  isSelected={entry.deck.name === selectedDeck}
                  onClick={() => onSelectDeck?.(entry.deck.name)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          <motion.button
            layout
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-milk-400 px-3 py-2 text-sm font-medium text-ink-300 transition-colors hover:border-mint-400 hover:text-mint-600"
            whileHover={{ scale: 0.985 }}
            whileTap={{ scale: 0.975 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            <Plus className="size-4" />
            New deck
          </motion.button>
        </div>
      </div>

      <CreateDeckDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingDecks={deckStats.decks.map((d) => d.name)}
        onCreated={(name) => onSelectDeck?.(name)}
      />
    </section>
  );
}
