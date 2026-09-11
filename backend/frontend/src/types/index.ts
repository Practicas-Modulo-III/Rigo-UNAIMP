/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BookCategory =
  | 'Todas'
  | 'Talleres y Plástica'
  | 'Biografías'
  | 'Tesis'
  | 'Pintura Piurana'
  | 'Artesanías y Folclore'
  | 'Escultura'
  | 'Historia Regional'
  | 'Cerámica';

/** Categorías asignables a un ejemplar. Excluye 'Todas', que solo existe como filtro. */
export const BOOK_CATEGORIES: readonly Exclude<BookCategory, 'Todas'>[] = [
  'Talleres y Plástica',
  'Biografías',
  'Tesis',
  'Pintura Piurana',
  'Artesanías y Folclore',
  'Escultura',
  'Historia Regional',
  'Cerámica',
];

export interface LocationInfo {
  pasillo: number; // 1, 2, or 3 (0 = Archivo / fuera de pasillos)
  estante: string; // e.g. "Estante A", "Estante B", "Archivo de Tesis"
  section?: string;
  tagCode: string; // e.g. "P2-EB"
  /** Texto de ubicación legible para inventario (ej. "Pasillo 1 - Estante 2") */
  display?: string;
}

export type BookStatus = 'available' | 'in_use' | 'reserved';

export interface BookDoc {
  id: string; // Código de catálogo: 750.01 | 750.02 | BIOG.01 — no usar TESIS-01 (ver D8 propuesta)
  title: string;
  author: string;
  category: BookCategory;
  year: number;
  location: LocationInfo;
  page: number;
  rigoSummary: string;
  matchScore?: string;
  status: BookStatus;
  returnTime?: string;
  /** Cantidad de ejemplares, formato institucional (ej. "01") */
  quantity?: string;
  pdfUrl?: string;
}

export interface SearchFilters {
  category: BookCategory;
  yearStart: number;
  yearEnd: number;
  pasillo: string; // 'Todos' | 'Pasillo 1' | 'Pasillo 2' | 'Pasillo 3'
}

export interface ChatMessage {
  id: number;
  sender: 'user' | 'rigo';
  text: string;
  time: string;
  sources?: BookDoc[];
  excerpt?: string;
  highlightedPasillo?: number;
  highlightedEstante?: string;
}

/** Registro de inventario para el panel de administración */
export interface InventoryItem {
  code: string;
  title: string;
  author: string;
  year: number;
  location: string;
  quantity: string;
  availability: 'available' | 'loan';
}

/** Nodo de estantería para el croquis 2D interactivo */
export interface ShelfNode {
  id: string; // UUID v4
  pasillo: number; // 1 | 2 | 3
  estante: string; // "Estante A" | "Estante B"
  code: string; // "P1-EA", "P2-EB"...
  name: string; // "Cerámica de Chulucanas"
  category: string; // "Artesanías y Folclore"
  description: string;
  bookCount: number;
  // Posición y tamaño (píxeles, canvas 960x804 — aspecto nativo de croquis-mvp.png 1024x858)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number; // 0, 90, 180, 270
  metadata?: {
    color?: string; // Color por pasillo (hex)
    tags?: string[];
    capacity?: number;
    lastUpdated: string; // ISO 8601
    updatedBy: string; // "admin" | "system"
  };
}

export interface CroquisLayout {
  version: number; // 1
  canvasWidth: number; // 960
  canvasHeight: number; // 804
  shelves: ShelfNode[];
}
