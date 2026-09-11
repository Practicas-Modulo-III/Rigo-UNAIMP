import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage } from 'react-konva';
import { MapPin } from 'lucide-react';
import type { ShelfNode } from '@/types';
import { FloorLayer } from './layers/FloorLayer';
import { ShelvesLayer } from './layers/ShelvesLayer';
import { LabelsLayer } from './layers/LabelsLayer';
import { INITIAL_SHELVES, PASILLOS_CONFIG } from './initialLayout';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 804;

interface CroquisViewerProps {
  shelves?: ShelfNode[];
  highlightPasillo?: number | null;
  highlightEstante?: string | null;
  onSelectShelf?: (pasillo: number, estante: string, category: string) => void;
}

interface PasilloPin {
  pasillo: number;
  leftPercent: number;
  topPercent: number;
  color: string;
  label: string;
}

/** Centro del bounding box de las secciones de cada pasillo, en porcentaje del lienzo (960x804) — permite anclar el indicador HTML sobre el canvas Konva sin recalcular en cada resize. */
function computePins(shelves: ShelfNode[]): PasilloPin[] {
  return PASILLOS_CONFIG.filter((config) => config.numero > 0)
    .map((config) => {
      const group = shelves.filter((shelf) => shelf.pasillo === config.numero);
      if (group.length === 0) return null;
      const minX = Math.min(...group.map((s) => s.x));
      const minY = Math.min(...group.map((s) => s.y));
      const maxX = Math.max(...group.map((s) => s.x + s.width));
      const maxY = Math.max(...group.map((s) => s.y + s.height));
      return {
        pasillo: config.numero,
        leftPercent: ((minX + maxX) / 2 / CANVAS_WIDTH) * 100,
        topPercent: ((minY + maxY) / 2 / CANVAS_HEIGHT) * 100,
        color: config.color,
        label: `Pasillo ${config.numero}: ${config.shortLabel}`,
      };
    })
    .filter((pin): pin is PasilloPin => pin !== null);
}

export function CroquisViewer({
  shelves,
  highlightPasillo = null,
  highlightEstante = null,
  onSelectShelf,
}: CroquisViewerProps) {
  const data = shelves ?? INITIAL_SHELVES;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const pins = useMemo(() => computePins(data), [data]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        setScale(w / CANVAS_WIDTH);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
      <div className="relative" style={{ width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale }}>
        {/* Stage debe recibir el tamaño YA escalado: si se le pasa el tamaño nativo (960x804)
            y solo se escala el contenido vía scaleX/scaleY, el <canvas> real sigue siendo
            960x804 y el div contenedor (más chico) lo recorta con overflow-hidden — el croquis
            se ve "incompleto" en pantallas angostas. Al escalar el propio Stage, canvas y
            contenedor miden exactamente lo mismo y no hay recorte. */}
        <Stage width={CANVAS_WIDTH * scale} height={CANVAS_HEIGHT * scale} scaleX={scale} scaleY={scale} style={{ display: 'block' }}>
          <FloorLayer />
          <ShelvesLayer
            shelves={data}
            highlightPasillo={highlightPasillo}
            highlightEstante={highlightEstante}
            onSelectShelf={onSelectShelf}
          />
          <LabelsLayer shelves={data} showPasilloLabels={false} />
        </Stage>

        {pins.map((pin) => {
          const isActive = highlightPasillo === pin.pasillo;
          // Las estanterías de pared quedan pegadas al borde: si centráramos siempre el
          // indicador, la mitad se saldría del lienzo y overflow-hidden la recortaría.
          const anchor =
            pin.leftPercent < 20 ? 'translate-x-0' : pin.leftPercent > 80 ? '-translate-x-full' : '-translate-x-1/2';
          return (
            <span
              key={pin.pasillo}
              className={
                'pointer-events-none absolute inline-flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold shadow-lg ring-1 ring-inset transition-all ' +
                anchor +
                (isActive ? ' bg-rose-500 text-white ring-rose-300/60' : ' bg-white/90 ring-slate-300 dark:bg-slate-950/85 dark:ring-slate-700')
              }
              style={{ left: `${pin.leftPercent}%`, top: `${pin.topPercent}%`, color: isActive ? undefined : pin.color }}
            >
              <MapPin className="h-3 w-3 shrink-0" />
              {pin.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
