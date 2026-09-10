import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage } from 'react-konva';
import { Plus } from 'lucide-react';
import type { ShelfNode } from '@/types';
import { FloorLayer } from './layers/FloorLayer';
import { ShelvesLayer } from './layers/ShelvesLayer';
import { LabelsLayer } from './layers/LabelsLayer';
import { ShelfEditorPanel } from './shelf/ShelfEditorPanel';
import { INITIAL_SHELVES } from './initialLayout';

interface CroquisEditorProps {
  shelves?: ShelfNode[];
  selectedId?: string | null;
  highlightPasillo?: number | null;
  highlightEstante?: string | null;
  onSelect?: (id: string | null) => void;
  onSelectShelf?: (pasillo: number, estante: string, category: string) => void;
  onUpdateShelf?: (id: string, updates: Partial<ShelfNode>) => void;
  onAddShelf?: (shelf: Omit<ShelfNode, 'id'>) => void;
  onDeleteShelf?: (id: string) => void;
  isAdmin?: boolean;
}

function blankShelf(): Omit<ShelfNode, 'id'> {
  return {
    pasillo: 0,
    estante: 'Nueva sección',
    code: 'NUEVO',
    name: 'Nueva sección',
    category: 'Sin categoría',
    description: '',
    bookCount: 0,
    x: 420,
    y: 360,
    width: 100,
    height: 80,
    metadata: { color: '#94a3b8', lastUpdated: new Date().toISOString(), updatedBy: 'admin' },
  };
}

export function CroquisEditor({ shelves, selectedId, highlightPasillo = null, highlightEstante = null, onSelect, onSelectShelf, onUpdateShelf, onAddShelf, onDeleteShelf, isAdmin = true }: CroquisEditorProps) {
  const [fallbackItems, setFallbackItems] = useState<ShelfNode[]>(shelves ?? INITIAL_SHELVES);
  const [fallbackSelectedId, setFallbackSelectedId] = useState<string | null>(null);
  const items = shelves ?? fallbackItems;
  const activeSelectedId = selectedId ?? fallbackSelectedId;
  const selectedShelf = items.find((shelf) => shelf.id === activeSelectedId) ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setScale(entry.contentRect.width / 960);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleSelect = useCallback((id: string) => {
    if (onSelect) onSelect(id);
    else setFallbackSelectedId(id);
  }, [onSelect]);

  const handleDragEnd = useCallback((id: string, x: number, y: number) => {
    if (onUpdateShelf) onUpdateShelf(id, { x, y });
    else setFallbackItems((previous) => previous.map((shelf) => shelf.id === id ? { ...shelf, x, y } : shelf));
  }, [onUpdateShelf]);

  const handleShelfChange = useCallback((id: string, updates: Partial<ShelfNode>) => {
    if (onUpdateShelf) onUpdateShelf(id, updates);
    else setFallbackItems((previous) => previous.map((shelf) => shelf.id === id ? { ...shelf, ...updates } : shelf));
  }, [onUpdateShelf]);

  const handleAdd = useCallback(() => {
    const shelf = blankShelf();
    if (onAddShelf) onAddShelf(shelf);
    else setFallbackItems((previous) => [...previous, { ...shelf, id: 'shelf-' + Date.now() }]);
  }, [onAddShelf]);

  const handleDelete = useCallback((id: string) => {
    if (onDeleteShelf) onDeleteShelf(id);
    else setFallbackItems((previous) => previous.filter((shelf) => shelf.id !== id));
    if (onSelect) onSelect(null);
    else setFallbackSelectedId(null);
  }, [onDeleteShelf, onSelect]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-lg dark:border-slate-800">
        <div style={{ width: 960 * scale, height: 804 * scale }}>
          {/* Stage recibe el tamaño ya escalado (ver nota en CroquisViewer.tsx) para que el
              canvas no quede más grande que su contenedor y sea recortado por overflow-hidden. */}
          <Stage width={960 * scale} height={804 * scale} scaleX={scale} scaleY={scale} style={{ display: 'block' }}>
            <FloorLayer />
            <ShelvesLayer shelves={items} isAdmin={isAdmin} selectedId={activeSelectedId} highlightPasillo={highlightPasillo} highlightEstante={highlightEstante} onSelect={handleSelect} onSelectShelf={onSelectShelf} onDragEnd={handleDragEnd} />
            <LabelsLayer shelves={items} />
          </Stage>
        </div>
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/40">Modo edición · arrastra las secciones</span>
        <button
          type="button"
          onClick={handleAdd}
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-lg transition-colors hover:bg-emerald-300"
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva sección
        </button>
      </div>

      {selectedShelf ? (
        <ShelfEditorPanel
          shelf={selectedShelf}
          onChange={handleShelfChange}
          onDelete={handleDelete}
          onClose={() => (onSelect ? onSelect(null) : setFallbackSelectedId(null))}
        />
      ) : null}
    </div>
  );
}
