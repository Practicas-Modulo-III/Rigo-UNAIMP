import { Layer } from 'react-konva';
import type { ShelfNode as ShelfNodeData } from '@/types';
import { ShelfNode } from '../shelf/ShelfNode';

interface ShelvesLayerProps {
  shelves?: ShelfNodeData[];
  isAdmin?: boolean;
  selectedId?: string | null;
  highlightPasillo?: number | null;
  highlightEstante?: string | null;
  onSelect?: (id: string) => void;
  onSelectShelf?: (pasillo: number, estante: string, category: string) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
}

export function ShelvesLayer({
  shelves = [],
  isAdmin = false,
  selectedId = null,
  highlightPasillo = null,
  highlightEstante = null,
  onSelect,
  onSelectShelf,
  onDragEnd,
}: ShelvesLayerProps) {
  return (
    <Layer>
      {shelves.map((shelf) => {
        const pasilloMatch = highlightPasillo != null && shelf.pasillo === highlightPasillo;
        const estanteMatch = highlightEstante == null || shelf.estante === highlightEstante;
        return (
          <ShelfNode
            key={shelf.id}
            shelf={shelf}
            isHighlighted={pasilloMatch && estanteMatch}
            isSelected={selectedId === shelf.id}
            draggable={isAdmin}
            onSelect={onSelect}
            onSelectShelf={onSelectShelf}
            onDragEnd={onDragEnd}
          />
        );
      })}
    </Layer>
  );
}