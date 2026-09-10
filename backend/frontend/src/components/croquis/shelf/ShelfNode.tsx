import { Group, Rect, Text } from 'react-konva';
import type { ShelfNode as ShelfNodeData } from '@/types';

export const SHELF_COLORS: Record<number, string> = {
  1: '#06b6d4',
  2: '#f59e0b',
  3: '#a855f7',
};

interface ShelfNodeProps {
  shelf: ShelfNodeData;
  isHighlighted?: boolean;
  isSelected?: boolean;
  draggable?: boolean;
  onSelect?: (id: string) => void;
  onSelectShelf?: (pasillo: number, estante: string, category: string) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
}

export function ShelfNode({
  shelf,
  isHighlighted = false,
  isSelected = false,
  draggable = false,
  onSelect,
  onSelectShelf,
  onDragEnd,
}: ShelfNodeProps) {
  const color = shelf.metadata?.color ?? SHELF_COLORS[shelf.pasillo] ?? '#64748b';

  const handleClick = () => {
    onSelect?.(shelf.id);
    onSelectShelf?.(shelf.pasillo, shelf.estante, shelf.category);
  };

  return (
    <Group
      x={shelf.x + shelf.width / 2}
      y={shelf.y + shelf.height / 2}
      offsetX={shelf.width / 2}
      offsetY={shelf.height / 2}
      rotation={shelf.rotation ?? 0}
      scaleX={isHighlighted ? 1.05 : 1}
      scaleY={isHighlighted ? 1.05 : 1}
      draggable={draggable}
      onClick={handleClick}
      onTap={handleClick}
      onDragEnd={(e) =>
        onDragEnd?.(
          shelf.id,
          Math.round(e.target.x() - shelf.width / 2),
          Math.round(e.target.y() - shelf.height / 2),
        )
      }
      cursor={draggable ? 'move' : 'pointer'}
    >
      <Rect
        width={shelf.width}
        height={shelf.height}
        fill={isHighlighted ? '#f43f5e' : isSelected ? '#38bdf8' : color}
        opacity={isHighlighted ? 0.85 : isSelected ? 0.75 : draggable ? 0.16 : 0.0}
        cornerRadius={6}
        stroke={isHighlighted ? '#fff1f2' : isSelected ? '#e0f2fe' : draggable ? color : 'transparent'}
        strokeWidth={isHighlighted || isSelected ? 2 : draggable ? 1.5 : 0}
        dash={draggable && !isSelected && !isHighlighted ? [4, 3] : undefined}
        shadowColor={isHighlighted ? '#f43f5e' : isSelected ? '#38bdf8' : undefined}
        shadowBlur={isHighlighted ? 22 : isSelected ? 12 : 0}
      />
      <Text
        x={8}
        y={6}
        text={shelf.code}
        fontSize={10}
        fontFamily="monospace"
        fontStyle="bold"
        fill={isHighlighted ? '#fff1f2' : draggable ? '#fef3c7' : '#fbbf24'}
        shadowColor="#0f172a"
        shadowBlur={draggable ? 3 : 0}
        shadowOpacity={0.9}
      />
      <Text
        x={4}
        y={16}
        width={shelf.width - 8}
        height={shelf.height - 32}
        align="center"
        verticalAlign="middle"
        text={shelf.name}
        fontSize={10}
        fontStyle="bold"
        wrap="word"
        fill="#f8fafc"
        shadowColor="#0f172a"
        shadowBlur={3}
        shadowOpacity={0.9}
      />
      <Text
        x={shelf.width - 56}
        y={shelf.height - 16}
        width={48}
        align="right"
        text={`${shelf.bookCount} refs`}
        fontSize={9}
        fontFamily="monospace"
        fill="#94a3b8"
      />
    </Group>
  );
}