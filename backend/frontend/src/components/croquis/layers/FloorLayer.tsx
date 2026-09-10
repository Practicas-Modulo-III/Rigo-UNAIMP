import { useEffect, useState } from 'react';
import { Layer, Image as KonvaImage, Rect, Text } from 'react-konva';

interface FloorLayerProps {
  width?: number;
  height?: number;
}

export function FloorLayer({ width = 960, height = 804 }: FloorLayerProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = new window.Image();
    image.src = '/croquis-mvp.png';
    image.onload = () => setImg(image);
  }, []);

  return (
    <Layer listening={false}>
      {/* Fondo blanco para letterbox */}
      <Rect x={0} y={0} width={width} height={height} fill="#0f172a" />
      {img ? (
        <KonvaImage image={img} x={0} y={0} width={width} height={height} />
      ) : (
        <Rect x={0} y={0} width={width} height={height} fill="#f5f1e8" />
      )}
      {/* Marca de agua sutil */}
      <Text x={width - 78} y={height - 18} text="RIGO · UNA Piura" fontSize={7} fontFamily="monospace" fill="rgba(255,255,255,0.7)" />
    </Layer>
  );
}
