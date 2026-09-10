import { Suspense, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { ShelfNode } from '@/types';
import { INITIAL_SHELVES, PASILLOS_CONFIG } from './initialLayout';

// El tipo de instancia sale del propio componente de drei: evita depender de three-stdlib,
// que es una dependencia transitiva y pnpm no expone en node_modules.
type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;

// El croquis 2D vive en un lienzo de 960x804 px. En 3D usamos 1 unidad = 10 px y
// centramos la sala en el origen, así la escena mide 96 x 80.4 unidades.
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 804;
const UNIT = 0.1;
const ROOM_WIDTH = CANVAS_WIDTH * UNIT;
const ROOM_DEPTH = CANVAS_HEIGHT * UNIT;
const HIGHLIGHT_COLOR = '#f43f5e';
const SHELF_HEIGHT = 3.1;
const ROW_COUNT = 4;
const BOOK_SPACING = 0.42;

/** Paleta de lomos de libro — tonos cálidos de biblioteca, deliberadamente variados. */
const BOOK_COLORS = [
  '#b45309',
  '#7c2d12',
  '#1d4ed8',
  '#0f766e',
  '#166534',
  '#a16207',
  '#7e22ce',
  '#991b1b',
  '#0e7490',
  '#4d7c0f',
  '#9a3412',
  '#3730a3',
];

/** Hash determinista simple: mismo índice siempre da el mismo "azar" (sin parpadeos entre renders). */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Textura de texto dibujada en un <canvas> 2D — evita el renderizador SDF de drei/troika,
    que revienta el contexto WebGL en GPUs débiles o con rasterizado por software (típico en
    hardware de kiosko). Mismo resultado visual, muchísimo más robusto. */
function makeTextTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface ShelfBox {
  shelf: ShelfNode;
  /** Centro de la estantería en coordenadas de mundo (x, z). */
  center: [number, number];
  /** Tamaño en planta ya convertido a unidades de mundo: [ancho en X, profundidad en Z]. */
  footprint: [number, number];
  color: string;
}

function colorFor(shelf: ShelfNode): string {
  return shelf.metadata?.color ?? PASILLOS_CONFIG.find((c) => c.numero === shelf.pasillo)?.color ?? '#64748b';
}

function toBoxes(shelves: ShelfNode[]): ShelfBox[] {
  return shelves.map((shelf) => ({
    shelf,
    center: [
      (shelf.x + shelf.width / 2 - CANVAS_WIDTH / 2) * UNIT,
      (shelf.y + shelf.height / 2 - CANVAS_HEIGHT / 2) * UNIT,
    ],
    footprint: [shelf.width * UNIT, shelf.height * UNIT],
    color: colorFor(shelf),
  }));
}

/** Piso de baldosa clara con juntas sutiles — sala real, no la foto cenital aplanada. */
function Floor() {
  const tileTexture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#e7dcc8';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#cdbfa2';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(ROOM_WIDTH / 4, ROOM_DEPTH / 4);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);

  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
      <meshStandardMaterial map={tileTexture} roughness={0.9} metalness={0} />
    </mesh>
  );
}

/** Paredes perimetrales — dan sensación de sala cerrada sin tapar la vista desde arriba. */
function RoomFrame() {
  const wallHeight = 6;
  const walls: Array<{ position: [number, number, number]; size: [number, number, number] }> = [
    { position: [0, wallHeight / 2, -ROOM_DEPTH / 2], size: [ROOM_WIDTH, wallHeight, 0.4] },
    { position: [0, wallHeight / 2, ROOM_DEPTH / 2], size: [ROOM_WIDTH, wallHeight, 0.4] },
    { position: [-ROOM_WIDTH / 2, wallHeight / 2, 0], size: [0.4, wallHeight, ROOM_DEPTH] },
    { position: [ROOM_WIDTH / 2, wallHeight / 2, 0], size: [0.4, wallHeight, ROOM_DEPTH] },
  ];
  return (
    <group>
      {walls.map((wall, index) => (
        <mesh key={index} position={wall.position} receiveShadow>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      ))}
    </group>
  );
}

/** Lomos de libro instanciados: una sola malla por estante, cientos de "libros" sin costo de dibujo extra. */
function BookRows({
  length,
  depth,
  lengthAxis,
  openSign,
}: {
  length: number;
  depth: number;
  lengthAxis: 'x' | 'z';
  openSign: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const bookDepth = Math.min(0.7, depth * 0.55);
  const count = Math.max(1, Math.floor(length / BOOK_SPACING));

  // useLayoutEffect (no useMemo): el <instancedMesh> aún no existe durante el render, el ref
  // solo queda listo tras el commit — escribir las matrices ahí evita instancias en blanco.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const rowGap = SHELF_HEIGHT / (ROW_COUNT + 1);
    let i = 0;
    for (let row = 0; row < ROW_COUNT; row += 1) {
      const y = rowGap * (row + 1) - SHELF_HEIGHT / 2 + 0.35;
      for (let col = 0; col < count; col += 1) {
        const seed = row * 1000 + col;
        const along = (col + 0.5) * BOOK_SPACING - length / 2 + (pseudoRandom(seed) - 0.5) * 0.06;
        const bookHeight = 0.85 + pseudoRandom(seed + 7) * 0.5;
        const bookWidth = BOOK_SPACING * (0.65 + pseudoRandom(seed + 13) * 0.3);
        const faceOffset = (depth / 2 - bookDepth / 2 - 0.05) * openSign;

        if (lengthAxis === 'x') {
          dummy.position.set(along, y, faceOffset);
          dummy.scale.set(bookWidth, bookHeight, bookDepth);
        } else {
          dummy.position.set(faceOffset, y, along);
          dummy.scale.set(bookDepth, bookHeight, bookWidth);
        }
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        color.set(BOOK_COLORS[Math.floor(pseudoRandom(seed + 21) * BOOK_COLORS.length)]);
        mesh.setColorAt(i, color);
        i += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, depth, lengthAxis, openSign, count]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count * ROW_COUNT]} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.75} metalness={0.05} />
    </instancedMesh>
  );
}

interface BookshelfProps {
  box: ShelfBox;
  isHighlighted: boolean;
  onSelect?: (shelf: ShelfNode) => void;
}

/** Estantería real: armazón de madera + tablas + libros instanciados + rótulo 3D — nada de cajas planas. */
function Bookshelf({ box, isHighlighted, onSelect }: BookshelfProps) {
  const [hovered, setHovered] = useState(false);
  const { shelf, center, footprint, color } = box;
  const [sizeX, sizeZ] = footprint;
  const lengthAxis: 'x' | 'z' = sizeX >= sizeZ ? 'x' : 'z';
  const length = lengthAxis === 'x' ? sizeX : sizeZ;
  const depth = lengthAxis === 'x' ? sizeZ : sizeX;
  // El lado abierto (donde van los libros) mira hacia el centro de la sala, no hacia la pared.
  const openSign = lengthAxis === 'x' ? (center[1] <= 0 ? 1 : -1) : (center[0] <= 0 ? 1 : -1);
  const signRotationY = lengthAxis === 'x' ? (openSign > 0 ? 0 : Math.PI) : (openSign > 0 ? Math.PI / 2 : -Math.PI / 2);
  const activeColor = isHighlighted ? HIGHLIGHT_COLOR : color;
  const codeTexture = useMemo(() => makeTextTexture(shelf.code), [shelf.code]);

  // El armazón sólido solo ocupa la mitad trasera (contra la pared): si llenara toda la
  // profundidad taparía tablas y libros como una tapa — con esto quedan a la vista al frente.
  const carcassDepth = depth * 0.55;
  const carcassOffset = ((depth - carcassDepth) / 2) * -openSign;
  const carcassSize: [number, number, number] =
    lengthAxis === 'x' ? [length, SHELF_HEIGHT, carcassDepth] : [carcassDepth, SHELF_HEIGHT, length];
  const carcassPosition: [number, number, number] =
    lengthAxis === 'x' ? [0, SHELF_HEIGHT / 2, carcassOffset] : [carcassOffset, SHELF_HEIGHT / 2, 0];
  // El clic funciona en toda la huella (invisible), así el armazón angosto no reduce el área clicable.
  const hitboxSize: [number, number, number] =
    lengthAxis === 'x' ? [length, SHELF_HEIGHT, depth] : [depth, SHELF_HEIGHT, length];

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect?.(shelf);
  };

  const shelfBoardY = [1, 2, 3].map((row) => (SHELF_HEIGHT / (ROW_COUNT + 1)) * row - SHELF_HEIGHT / 2 + 0.1);

  return (
    <group position={[center[0], 0, center[1]]}>
      {/* Caja invisible del tamaño completo, solo para clic/hover — meshBasicMaterial con
          opacity 0 en vez de `visible={false}`, porque three.js ignora objetos no visibles
          al lanzar rayos (el clic dejaría de funcionar). */}
      <mesh
        position={[0, SHELF_HEIGHT / 2, 0]}
        onClick={handleClick}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <boxGeometry args={hitboxSize} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Armazón: madera oscura sólida contra la pared — le da el volumen que faltaba. */}
      <mesh position={carcassPosition} castShadow receiveShadow>
        <boxGeometry args={carcassSize} />
        <meshStandardMaterial color="#3b2a1d" roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Tablas horizontales del estante, apenas más claras que el armazón. */}
      {shelfBoardY.map((y, index) => (
        <mesh
          key={index}
          position={[0, y, 0]}
          scale={lengthAxis === 'x' ? [length * 0.98, 0.08, depth * 0.95] : [depth * 0.95, 0.08, length * 0.98]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#5c4331" roughness={0.7} />
        </mesh>
      ))}

      <BookRows length={length} depth={depth} lengthAxis={lengthAxis} openSign={openSign} />

      {/* Franja de color en el borde frontal (delgada, NO del tamaño de la huella completa:
          eso era el bug que tapaba el armazón, las tablas y los libros como un techo). */}
      <mesh
        position={[
          lengthAxis === 'x' ? 0 : (depth / 2 - 0.15) * openSign,
          SHELF_HEIGHT + 0.15,
          lengthAxis === 'x' ? (depth / 2 - 0.15) * openSign : 0,
        ]}
        scale={lengthAxis === 'x' ? [length * 0.98, 0.22, 0.32] : [0.32, 0.22, length * 0.98]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={activeColor}
          emissive={activeColor}
          emissiveIntensity={isHighlighted ? 0.9 : hovered ? 0.5 : 0.25}
        />
      </mesh>

      {/* Código en geometría 3D real (no HTML): se oculta tras la estantería en vez de amontonarse. */}
      <mesh
        position={[
          lengthAxis === 'x' ? 0 : (depth / 2 + 0.06) * openSign,
          SHELF_HEIGHT + 0.18,
          lengthAxis === 'x' ? (depth / 2 + 0.06) * openSign : 0,
        ]}
        rotation={[0, signRotationY, 0]}
      >
        <planeGeometry args={[1.6, 0.4]} />
        <meshBasicMaterial map={codeTexture} transparent toneMapped={false} />
      </mesh>

      {(isHighlighted || hovered) && shelf.pasillo > 0 ? (
        <Html position={[0, SHELF_HEIGHT + 1.1, 0]} center distanceFactor={55} zIndexRange={[20, 0]} occlude>
          <span
            className={
              'pointer-events-none inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold shadow-lg ring-1 ring-inset ' +
              (isHighlighted ? 'bg-rose-500 text-white ring-rose-300/60' : 'bg-slate-950/85 ring-slate-700')
            }
            style={{ color: isHighlighted ? undefined : color }}
          >
            {shelf.name}
          </span>
        </Html>
      ) : null}
    </group>
  );
}

/** Mueble bajo del área de archivo (pasillo 0) — cajonera simple, sin libros. */
function ArchiveCabinet({ box }: { box: ShelfBox }) {
  const { center, footprint } = box;
  return (
    <group position={[center[0], 0, center[1]]}>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[footprint[0] * 0.96, 1.5, footprint[1] * 0.96]} />
        <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <boxGeometry args={[footprint[0] * 0.98, 0.1, footprint[1] * 0.98]} />
        <meshStandardMaterial color="#475569" roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Mesa de lectura con sillas — mobiliario decorativo en el área central, como en la foto original. */
function ReadingTable({ position, chairs = 4 }: { position: [number, number]; chairs?: number }) {
  const [x, z] = position;
  const tableW = 3.4;
  const tableD = 1.6;
  const chairPositions: Array<[number, number, number]> = [];
  const perSide = Math.ceil(chairs / 2);
  for (let i = 0; i < perSide; i += 1) {
    const along = (i - (perSide - 1) / 2) * (tableW / perSide);
    chairPositions.push([along, -(tableD / 2 + 0.55), 0]);
    if (chairPositions.length < chairs) chairPositions.push([along, tableD / 2 + 0.55, Math.PI]);
  }

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[tableW, 0.08, tableD]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.35} metalness={0.1} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}-${sz}`} position={[(sx * tableW) / 2 - sx * 0.15, 0.37, (sz * tableD) / 2 - sz * 0.1]}>
            <boxGeometry args={[0.08, 0.74, 0.08]} />
            <meshStandardMaterial color="#0f172a" roughness={0.6} />
          </mesh>
        )),
      )}
      {chairPositions.map(([cx, cz], index) => (
        <group key={index} position={[cx, 0, cz]}>
          <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[0.5, 0.06, 0.5]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.7, -0.22]}>
            <boxGeometry args={[0.5, 0.5, 0.06]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

interface CameraFocusProps {
  target: [number, number] | null;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}

/** Acerca suavemente la cámara a la estantería resaltada por RIGO. */
function CameraFocus({ target, controlsRef }: CameraFocusProps) {
  const desired = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    desired.current.set(target ? target[0] : 0, target ? 1.6 : 0, target ? target[1] : 0);
    if (controls.target.distanceTo(desired.current) < 0.05) return;
    controls.target.lerp(desired.current, 0.08);
    controls.update();
  });

  return null;
}

interface Croquis3DViewerProps {
  shelves?: ShelfNode[];
  highlightPasillo?: number | null;
  highlightEstante?: string | null;
  onSelectShelf?: (pasillo: number, estante: string, category: string) => void;
}

export function Croquis3DViewer({
  shelves,
  highlightPasillo = null,
  highlightEstante = null,
  onSelectShelf,
}: Croquis3DViewerProps) {
  const data = shelves ?? INITIAL_SHELVES;
  const boxes = useMemo(() => toBoxes(data), [data]);
  const shelfBoxes = boxes.filter((box) => box.shelf.pasillo > 0);
  const archiveBoxes = boxes.filter((box) => box.shelf.pasillo === 0);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const isHighlighted = (shelf: ShelfNode) =>
    highlightPasillo != null &&
    shelf.pasillo === highlightPasillo &&
    (highlightEstante == null || shelf.estante === highlightEstante);

  const focusTarget = useMemo(() => {
    const match = boxes.find((box) => isHighlighted(box.shelf));
    return match ? match.center : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxes, highlightPasillo, highlightEstante]);

  // Mesas de lectura decorativas en el área central abierta, como en la foto de referencia.
  const tables: Array<[number, number]> = [
    [0, -20],
    [-2.2, 4],
    [2.2, 4],
    [-2.2, 16],
    [2.2, 16],
  ];

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-lg">
      <div className="aspect-[960/804] w-full">
        {/* Cámara a ~105 unidades: con fov 45 y lienzo 1.194:1 el campo visible mide ~103 x 87
            unidades, justo lo necesario para encuadrar la sala de 96 x 80.4 con un margen mínimo. */}
        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 73, 75], fov: 45, near: 0.1, far: 500 }}>
          <color attach="background" args={['#0b1220']} />
          <hemisphereLight intensity={0.5} groundColor="#0f172a" />
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[35, 55, 25]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-left={-ROOM_WIDTH / 1.6}
            shadow-camera-right={ROOM_WIDTH / 1.6}
            shadow-camera-top={ROOM_DEPTH / 1.6}
            shadow-camera-bottom={-ROOM_DEPTH / 1.6}
          />

          <Suspense fallback={null}>
            <Floor />
          </Suspense>
          <RoomFrame />

          {shelfBoxes.map((box) => (
            <Bookshelf
              key={box.shelf.id}
              box={box}
              isHighlighted={isHighlighted(box.shelf)}
              onSelect={(shelf) => onSelectShelf?.(shelf.pasillo, shelf.estante, shelf.category)}
            />
          ))}

          {archiveBoxes.map((box) => (
            <ArchiveCabinet key={box.shelf.id} box={box} />
          ))}

          {tables.map((position, index) => (
            <ReadingTable key={index} position={position} />
          ))}

          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.08}
            minDistance={20}
            maxDistance={180}
            maxPolarAngle={Math.PI / 2.15}
            makeDefault
          />
          <CameraFocus target={focusTarget} controlsRef={controlsRef} />
        </Canvas>
      </div>

      <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-slate-950/80 px-3 py-1 text-[11px] font-medium text-slate-300 ring-1 ring-inset ring-slate-700">
        Arrastra para girar · rueda para acercar · clic en una estantería
      </span>
    </div>
  );
}
