import { PASILLOS_CONFIG } from '@/components/croquis/initialLayout';
import type { ShelfNode } from '@/types';

interface StandsGridProps {
  shelves: ShelfNode[];
  activePasillo?: number | null;
  activeEstante?: string | null;
  onSelect?: (shelf: ShelfNode) => void;
}

function colorFor(pasillo: number): string {
  return PASILLOS_CONFIG.find((config) => config.numero === pasillo)?.color ?? '#94a3b8';
}

export function StandsGrid({ shelves, activePasillo = null, activeEstante = null, onSelect }: StandsGridProps) {
  const stands = shelves.filter((shelf) => shelf.pasillo > 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {stands.map((shelf) => {
        const isActive =
          activePasillo === shelf.pasillo && (activeEstante == null || activeEstante === shelf.estante);
        const color = colorFor(shelf.pasillo);
        return (
          <button
            key={shelf.id}
            type="button"
            onClick={() => onSelect?.(shelf)}
            className={
              'flex flex-col gap-1 rounded-lg border bg-white dark:bg-slate-900 p-3 text-left transition-colors ' +
              (isActive
                ? 'border-rose-500 ring-1 ring-inset ring-rose-500/50'
                : 'border-slate-200 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600')
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold" style={{ color }}>
                {shelf.code}
              </span>
              <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                {shelf.bookCount} docs
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {shelf.code}: {shelf.name}
            </p>
            <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{shelf.description}</p>
          </button>
        );
      })}
    </div>
  );
}
