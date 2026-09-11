import { useCallback, useMemo, useState } from 'react';
import type { CroquisLayout, ShelfNode } from '@/types';

export function useCroquis(initialLayout: CroquisLayout) {
  const [layout, setLayout] = useState<CroquisLayout>(initialLayout);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const shelves = layout.shelves;

  const updateShelf = useCallback((id: string, updates: Partial<ShelfNode>) => {
    setLayout((current) => ({ ...current, shelves: current.shelves.map((shelf) => shelf.id === id ? { ...shelf, ...updates } : shelf) }));
    setIsDirty(true);
  }, []);

  /** Devuelve el id generado para que quien la crea pueda seleccionarla de inmediato. */
  const addShelf = useCallback((shelf: Omit<ShelfNode, 'id'>): string => {
    const id = globalThis.crypto?.randomUUID?.() ?? 'shelf-' + Date.now();
    setLayout((current) => ({ ...current, shelves: [...current.shelves, { ...shelf, id }] }));
    setIsDirty(true);
    return id;
  }, []);

  const deleteShelf = useCallback((id: string) => {
    setLayout((current) => ({ ...current, shelves: current.shelves.filter((shelf) => shelf.id !== id) }));
    setSelected((current) => current === id ? null : current);
    setIsDirty(true);
  }, []);

  const markSaved = useCallback(() => setIsDirty(false), []);

  // Applies a layout fetched from the backend, but never clobbers unsaved local edits.
  const hydrate = useCallback((remote: CroquisLayout) => {
    setIsDirty((dirty) => {
      if (!dirty) setLayout(remote);
      return dirty;
    });
  }, []);

  return useMemo(() => ({ layout, shelves, selectedId, isDirty, setSelected, updateShelf, addShelf, deleteShelf, markSaved, hydrate }), [layout, shelves, selectedId, isDirty, updateShelf, addShelf, deleteShelf, markSaved, hydrate]);
}
