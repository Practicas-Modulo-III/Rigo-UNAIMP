import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { ShelfNode } from '@/types';

interface ShelfEditorPanelProps {
  shelf: ShelfNode;
  onChange: (id: string, updates: Partial<ShelfNode>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const field = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500';
const label = 'text-xs font-medium text-slate-400';

export function ShelfEditorPanel({ shelf, onChange, onDelete, onClose }: ShelfEditorPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = (updates: Partial<ShelfNode>) => onChange(shelf.id, updates);

  return (
    <aside className="w-full shrink-0 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:w-72">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Editar sección</h3>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Cerrar edición">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <label className="block space-y-1">
          <span className={label}>Código</span>
          <input
            className={field + ' font-mono'}
            value={shelf.code}
            onChange={(e) => update({ code: e.target.value })}
            placeholder="P1-EA"
          />
        </label>

        <label className="block space-y-1">
          <span className={label}>Nombre de la sección</span>
          <input
            className={field}
            value={shelf.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Cerámica de Chulucanas"
          />
        </label>

        <label className="block space-y-1">
          <span className={label}>Categoría</span>
          <input
            className={field}
            value={shelf.category}
            onChange={(e) => update({ category: e.target.value })}
            placeholder="Artesanías y Folclore"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className={label}>Pasillo</span>
            <input
              type="number"
              className={field}
              value={shelf.pasillo}
              onChange={(e) => update({ pasillo: Number(e.target.value) })}
            />
          </label>
          <label className="block space-y-1">
            <span className={label}>Estante</span>
            <input
              className={field}
              value={shelf.estante}
              onChange={(e) => update({ estante: e.target.value })}
              placeholder="Estante A"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className={label}>Descripción</span>
          <textarea
            className={field}
            rows={3}
            value={shelf.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </label>

        <label className="block space-y-1">
          <span className={label}>Cantidad de libros</span>
          <input
            type="number"
            min={0}
            className={field}
            value={shelf.bookCount}
            onChange={(e) => update({ bookCount: Math.max(0, Number(e.target.value)) })}
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className={label}>Ancho (px)</span>
            <input
              type="number"
              min={20}
              className={field}
              value={Math.round(shelf.width)}
              onChange={(e) => update({ width: Math.max(20, Number(e.target.value)) })}
            />
          </label>
          <label className="block space-y-1">
            <span className={label}>Alto (px)</span>
            <input
              type="number"
              min={20}
              className={field}
              value={Math.round(shelf.height)}
              onChange={(e) => update({ height: Math.max(20, Number(e.target.value)) })}
            />
          </label>
        </div>

        {confirmDelete ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2">
            <p className="flex-1 text-xs text-rose-300">¿Eliminar esta sección del croquis?</p>
            <button type="button" onClick={() => setConfirmDelete(false)} className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800">
              Cancelar
            </button>
            <button type="button" onClick={() => onDelete(shelf.id)} className="rounded bg-rose-500 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-400">
              Confirmar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/30 px-3 py-2 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar sección
          </button>
        )}
      </div>
    </aside>
  );
}
