import { useCallback } from 'react';
import { INITIAL_SHELVES } from '@/components/croquis/initialLayout';
import { apiFetch } from '@/services/api';
import type { CroquisLayout } from '@/types';

export const CROQUIS_STORAGE_KEY = 'rigo-croquis-layout-v1';

// Bumped when the shelf coordinate system changes shape (e.g. canvas 960x540 -> 960x804
// recalibrated to croquis-mvp.png's native aspect, or new sections added/removed): a layout
// saved under the old shape would otherwise reapply stale/incomplete data on the new canvas.
const LAYOUT_VERSION = 3;

const fallbackLayout: CroquisLayout = { version: LAYOUT_VERSION, canvasWidth: 960, canvasHeight: 804, shelves: INITIAL_SHELVES };

export function useCroquisPersistence() {
  const load = useCallback((): CroquisLayout => {
    try {
      const raw = window.localStorage.getItem(CROQUIS_STORAGE_KEY);
      if (!raw) return fallbackLayout;
      const parsed = JSON.parse(raw) as CroquisLayout;
      return Array.isArray(parsed.shelves) && parsed.version === LAYOUT_VERSION ? parsed : fallbackLayout;
    } catch {
      return fallbackLayout;
    }
  }, []);

  const save = useCallback(async (layout: CroquisLayout, authToken: string | null): Promise<void> => {
    window.localStorage.setItem(CROQUIS_STORAGE_KEY, JSON.stringify(layout));
    if (!authToken) return;
    const res = await apiFetch('/api/croquis', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layout),
    });
    if (!res.ok) throw new Error('No se pudo guardar el croquis en el servidor');
  }, []);

  const fetchRemote = useCallback(async (): Promise<CroquisLayout | null> => {
    try {
      const res = await apiFetch('/api/croquis');
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !Array.isArray(data.shelves) || data.version !== LAYOUT_VERSION) return null;
      window.localStorage.setItem(CROQUIS_STORAGE_KEY, JSON.stringify(data));
      return data as CroquisLayout;
    } catch {
      return null;
    }
  }, []);

  return { load, save, fetchRemote };
}
