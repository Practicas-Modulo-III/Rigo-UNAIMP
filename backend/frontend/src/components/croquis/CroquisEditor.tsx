import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Stage } from 'react-konva';
import { Box, Map, Plus } from 'lucide-react';
import type { ShelfNode } from '@/types';
import { FloorLayer } from './layers/FloorLayer';
import { ShelvesLayer } from './layers/ShelvesLayer';
import { LabelsLayer } from './layers/LabelsLayer';
import { ShelfEditorPanel } from './shelf/ShelfEditorPanel';
import { INITIAL_SHELVES } from './initialLayout';

// Three.js pesa varios MB: solo se descarga si el admin abre la vista 3D.
const Croquis3DViewer = lazy(() =>
  import('./Croquis3DViewer').then((module) => ({ default: module.Croquis3DViewer })),
);

type EditorMode = '2d' | '3d';

interface CroquisEditorProps {
  shelves?: ShelfNode[];
  selectedId?: string | null;
  highlightPasillo?: number | null;
  highlightEstante?: string | null;
  onSelect?: (id: string | null) => void;
  onSelectShelf?: (pasillo: number, estante: string, category: string) => void;
  onUpdateShelf?: (id: string, updates: Partial<ShelfNode>) => void;
  onAddShelf?: (shelf: Omit<ShelfNode, 'id'>) => string | void;
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
  const [mode, setMode] = useState<EditorMode>('2d');

  // Depende de `mode` porque el contenedor 2D se desmonta al pasar a 3D: sin esto el observer
  // quedaría atado al nodo viejo y la escala del lienzo dejaría de actualizarse al volver.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setScale(entry.contentRect.width / 960);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  const handleSelect = useCallback((id: string | null) => {
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

  // Se selecciona la sección recién creada: en 3D aparece como un mueble más en medio de la
  // sala y, sin resaltarla y abrir su panel, no hay señal de que el botón hizo algo.
  const handleAdd = useCallback(() => {
    const shelf = blankShelf();
    if (onAddShelf) {
      const id = onAddShelf(shelf);
      if (typeof id === 'string') handleSelect(id);
      return;
    }
    const id = 'shelf-' + Date.now();
    setFallbackItems((previous) => [...previous, { ...shelf, id }]);
    handleSelect(id);
  }, [onAddShelf, handleSelect]);

  const handleDelete = useCallback((id: string) => {
    if (onDeleteShelf) onDeleteShelf(id);
    else setFallbackItems((previous) => previous.filter((shelf) => shelf.id !== id));
    if (onSelect) onSelect(null);
    else setFallbackSelectedId(null);
  }, [onDeleteShelf, onSelect]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* El lienzo mide 960x804 (relación 1.194): limitando el ANCHO a 58vh el croquis ocupa
          ~49vh de alto, así que cabecera + barra + croquis entran en una pantalla sin scroll. */}
      <div className="flex w-full max-w-[58vh] flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm transition-colors hover:bg-emerald-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva sección
          </button>

          <div className="inline-flex rounded-full bg-slate-200 p-1 dark:bg-slate-800">
            {([
              { id: '2d' as const, label: 'Vista 2D', icon: Map },
              { id: '3d' as const, label: 'Vista 3D', icon: Box },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ' +
                  (mode === id
                    ? 'bg-emerald-400 text-slate-950'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white')
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {mode === '3d' ? (
          <Suspense
            fallback={
              <div className="flex aspect-[960/804] w-full items-center justify-center rounded-xl border border-slate-300 bg-slate-100 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                Cargando croquis 3D…
              </div>
            }
          >
            <Croquis3DViewer
              shelves={items}
              highlightPasillo={highlightPasillo}
              highlightEstante={highlightEstante}
              editable={isAdmin}
              selectedId={activeSelectedId}
              onSelectId={handleSelect}
              onMoveShelf={handleDragEnd}
            />
          </Suspense>
        ) : (
          <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
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
          </div>
        )}
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
