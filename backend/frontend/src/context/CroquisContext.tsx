import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { CroquisLayout, ShelfNode } from '@/types';
import { useCroquis } from '@/hooks/useCroquis';
import { useCroquisPersistence } from '@/hooks/useCroquisPersistence';
import { getToken, useAuthToken } from '@/services/auth';

interface CroquisContextValue {
  layout: CroquisLayout;
  shelves: ShelfNode[];
  selectedId: string | null;
  isAdmin: boolean;
  isDirty: boolean;
  setSelected: (id: string | null) => void;
  updateShelf: (id: string, updates: Partial<ShelfNode>) => void;
  addShelf: (shelf: Omit<ShelfNode, 'id'>) => string;
  deleteShelf: (id: string) => void;
  loadLayout: () => CroquisLayout;
  saveLayout: () => Promise<void>;
}

const CroquisContext = createContext<CroquisContextValue | null>(null);

export function CroquisProvider({ children }: PropsWithChildren) {
  const persistence = useCroquisPersistence();
  const [initialLayout] = useState<CroquisLayout>(() => persistence.load());
  const croquis = useCroquis(initialLayout);
  const token = useAuthToken();

  useEffect(() => {
    let cancelled = false;
    persistence.fetchRemote().then((remote) => {
      if (!cancelled && remote) croquis.hydrate(remote);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: CroquisContextValue = {
    ...croquis,
    isAdmin: Boolean(token),
    loadLayout: persistence.load,
    saveLayout: async () => {
      await persistence.save(croquis.layout, getToken());
      croquis.markSaved();
    },
  };

  return <CroquisContext.Provider value={value}>{children}</CroquisContext.Provider>;
}

export function useCroquisContext(): CroquisContextValue {
  const context = useContext(CroquisContext);
  if (!context) throw new Error('useCroquisContext must be used inside CroquisProvider');
  return context;
}

