import { Layer, Text } from 'react-konva';
import type { ShelfNode } from '@/types';
import { SHELF_COLORS } from '../shelf/ShelfNode';

interface PasilloLabelPosition {
  pasillo: number;
  x: number;
  y: number;
}

// Pasillo 1 y 3 son estanterías verticales (paredes izquierda/derecha): la etiqueta
// se centra a su lado para no chocar con la etiqueta horizontal del Pasillo 2 (pared
// superior) en la esquina. Pasillo 2 mantiene la etiqueta encima del mueble.
const FALLBACK_LABELS: PasilloLabelPosition[] = [
  { pasillo: 1, x: 70, y: 200 },
  { pasillo: 2, x: 38, y: 4 },
  { pasillo: 3, x: 700, y: 330 },
];

const PASILLO_NUMBERS: number[] = [1, 2, 3];

// Pasillo 0 agrupa varias secciones sueltas (bloque servidor + módulos de pared
// inferior) que no forman una sola columna/fila contigua, así que en vez de un
// bounding box se etiqueta cada grupo por separado, sobre su propio módulo.
function computeArchivePositions(shelves?: ShelfNode[]): PasilloLabelPosition[] {
  const group = (shelves ?? []).filter((s) => s.pasillo === 0);
  return group.map((s) => ({ pasillo: 0, x: s.x, y: Math.max(2, s.y - 14) }));
}

function computePositions(shelves?: ShelfNode[]): PasilloLabelPosition[] {
  if (!shelves || shelves.length === 0) {
    return FALLBACK_LABELS;
  }
  return PASILLO_NUMBERS.map((pasillo) => {
    const group = shelves.filter((s) => s.pasillo === pasillo);
    if (group.length === 0) {
      return FALLBACK_LABELS.find((p) => p.pasillo === pasillo) ?? FALLBACK_LABELS[0];
    }
    const minX = Math.min(...group.map((s) => s.x));
    const minY = Math.min(...group.map((s) => s.y));
    const maxX = Math.max(...group.map((s) => s.x + s.width));
    const maxY = Math.max(...group.map((s) => s.y + s.height));
    const isVertical = maxY - minY > maxX - minX;
    if (isVertical) {
      // Columna vertical (pared izq./der.): centrar la etiqueta al lado, a media altura.
      const onLeftEdge = minX < 100;
      return {
        pasillo,
        x: onLeftEdge ? maxX + 6 : minX - 92,
        y: minY + (maxY - minY) / 2 - 8,
      };
    }
    return { pasillo, x: minX + 10, y: Math.max(4, minY - 16) };
  });
}

interface LabelsLayerProps {
  shelves?: ShelfNode[];
  /** Oculta el rótulo grande "Pasillo N" dibujado en el canvas — útil cuando ya existe un indicador HTML equivalente (pin flotante) encima, para no duplicar la etiqueta. */
  showPasilloLabels?: boolean;
}

export function LabelsLayer({ shelves, showPasilloLabels = true }: LabelsLayerProps) {
  const positions = showPasilloLabels ? computePositions(shelves) : [];
  const archivePositions = computeArchivePositions(shelves);

  return (
    <Layer listening={false}>
      {positions.map((pos) => (
        <Text
          key={pos.pasillo}
          x={pos.x}
          y={pos.y}
          text={`Pasillo ${pos.pasillo}`}
          fontSize={16}
          fontStyle="bold"
          fill={SHELF_COLORS[pos.pasillo]}
          padding={2}
        />
      ))}
      {archivePositions.map((pos, index) => (
        <Text
          key={`archivo-${index}`}
          x={pos.x}
          y={pos.y}
          text="Archivo"
          fontSize={9}
          fontStyle="bold"
          fill="#cbd5e1"
          shadowColor="#0f172a"
          shadowBlur={3}
          shadowOpacity={0.9}
        />
      ))}
    </Layer>
  );
}