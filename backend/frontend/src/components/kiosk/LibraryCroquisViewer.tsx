import { Suspense, lazy, useEffect, useState } from 'react';
import { Box, LayoutGrid, Map } from 'lucide-react';
import { CroquisEditor } from '@/components/croquis/CroquisEditor';
import { CroquisViewer } from '@/components/croquis/CroquisViewer';
import { INITIAL_SHELVES, PASILLOS_CONFIG } from '@/components/croquis/initialLayout';
import { StandsGrid } from '@/components/kiosk/StandsGrid';
import type { ShelfNode } from '@/types';

// Three.js pesa bastante: solo se descarga si el estudiante abre la vista 3D.
const Croquis3DViewer = lazy(() =>
  import('@/components/croquis/Croquis3DViewer').then((module) => ({ default: module.Croquis3DViewer })),
);

type CroquisMode = '2d' | '3d';

export interface LibraryCroquisViewerProps {
  highlightPasillo?: number | null;
  highlightEstante?: string | null;
  onSelectShelf: (pasillo: number, estante: string, category: string) => void;
  isAdmin?: boolean;
  shelves?: ShelfNode[];
  /** Solo el mapa, sin pestañas ni listado de stands — para huecos angostos como la ficha QR. */
  compact?: boolean;
}

export function LibraryCroquisViewer({
  highlightPasillo = null,
  highlightEstante = null,
  onSelectShelf,
  isAdmin = false,
  shelves,
  compact = false,
}: LibraryCroquisViewerProps) {
  const data = shelves ?? INITIAL_SHELVES;
  const [activePasillo, setActivePasillo] = useState<number | null>(highlightPasillo);
  const [mode, setMode] = useState<CroquisMode>('2d');

  // Cuando RIGO resalta un nuevo pasillo (respuesta del chat), la pestaña activa lo sigue.
  useEffect(() => setActivePasillo(highlightPasillo), [highlightPasillo]);

  if (isAdmin) {
    return <CroquisEditor highlightPasillo={highlightPasillo} highlightEstante={highlightEstante} onSelectShelf={onSelectShelf} shelves={shelves} isAdmin />;
  }

  const effectiveEstante = activePasillo === highlightPasillo ? highlightEstante : null;

  const selectPasillo = (pasillo: number, estante: string, category: string) => {
    setActivePasillo(pasillo);
    onSelectShelf(pasillo, estante, category);
  };

  if (compact) {
    return (
      <CroquisViewer
        shelves={data}
        highlightPasillo={highlightPasillo}
        highlightEstante={highlightEstante}
        onSelectShelf={onSelectShelf}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActivePasillo(null)}
          className={
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ' +
            (activePasillo === null
              ? 'bg-emerald-400 text-slate-950'
              : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700')
          }
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Ver Todo
        </button>
        {PASILLOS_CONFIG.filter((config) => config.numero > 0).map((config) => (
          <button
            key={config.numero}
            type="button"
            onClick={() => setActivePasillo(config.numero)}
            className={
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ' +
              (activePasillo === config.numero
                ? 'text-slate-950'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700')
            }
            style={activePasillo === config.numero ? { backgroundColor: config.color } : undefined}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activePasillo === config.numero ? undefined : config.color }} />
            Pasillo {config.numero} ({config.nombre})
          </button>
        ))}

        <div className="ml-auto inline-flex rounded-full bg-slate-200 p-1 dark:bg-slate-800">
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

      {/* El lienzo mide 960x804 (relación 1.194), así que limitar el ANCHO a 70vh deja el
          croquis en ~59vh de alto: entra completo en la pantalla del kiosco sin recortes. */}
      <div className="mx-auto w-full max-w-[52vh]">
        {mode === '3d' ? (
          <Suspense
            fallback={
              <div className="flex aspect-[960/804] w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-sm text-slate-400">
                Cargando croquis 3D…
              </div>
            }
          >
            <Croquis3DViewer
              shelves={data}
              highlightPasillo={activePasillo}
              highlightEstante={effectiveEstante}
              onSelectShelf={selectPasillo}
            />
          </Suspense>
        ) : (
          <CroquisViewer
            shelves={data}
            highlightPasillo={activePasillo}
            highlightEstante={effectiveEstante}
            onSelectShelf={selectPasillo}
          />
        )}
      </div>

      <StandsGrid shelves={data} activePasillo={activePasillo} activeEstante={effectiveEstante} onSelect={(shelf) => selectPasillo(shelf.pasillo, shelf.estante, shelf.category)} />
    </div>
  );
}

