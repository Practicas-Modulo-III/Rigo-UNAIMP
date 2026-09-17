import { Filter, X } from 'lucide-react';
import type { BookCategory, SearchFilters } from '@/types';
import { useCategories } from '@/hooks/useCategories';

const PASILLOS = ['Todos', 'Pasillo 1', 'Pasillo 2', 'Pasillo 3'];

const CURRENT_YEAR = new Date().getFullYear();

const selectCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const numberCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const labelCls = 'text-xs font-medium text-slate-500 dark:text-slate-400';

interface AdvancedSearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onClose?: () => void;
}

export function AdvancedSearchFilters({ filters, onFiltersChange, onClose }: AdvancedSearchFiltersProps) {
  const { names: categoryNames } = useCategories();
  const update = (patch: Partial<SearchFilters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <Filter className="h-4 w-4 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-widest">Parámetros de búsqueda vectorial (ChromaDB)</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {filters.yearStart} <span className="text-slate-400 dark:text-slate-500">—</span> {filters.yearEnd}
          </span>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar filtros"
              className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Categoría Temática</span>
          <select
            value={filters.category}
            onChange={(e) => update({ category: e.target.value as BookCategory })}
            className={selectCls}
          >
            <option value="Todas">Todas</option>
            {categoryNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Pasillo / Ubicación Física</span>
          <select value={filters.pasillo} onChange={(e) => update({ pasillo: e.target.value })} className={selectCls}>
            {PASILLOS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>Año de Publicación</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1900}
              max={CURRENT_YEAR}
              value={filters.yearStart}
              onChange={(e) => update({ yearStart: Number(e.target.value) })}
              className={numberCls}
              aria-label="Año desde"
            />
            <input
              type="number"
              min={1900}
              max={CURRENT_YEAR}
              value={filters.yearEnd}
              onChange={(e) => update({ yearEnd: Number(e.target.value) })}
              className={numberCls}
              aria-label="Año hasta"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
