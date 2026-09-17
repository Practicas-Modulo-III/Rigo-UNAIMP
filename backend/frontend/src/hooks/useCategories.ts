import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/services/api';
import { BOOK_CATEGORIES } from '@/types';

export interface CategoryItem {
  id: number;
  name: string;
  book_count: number;
}

/** Shared source of truth for the category list: backend `categories` table, editable by admins.
 * Falls back to the old hardcoded defaults while the request is in flight or if it fails, so the
 * kiosk/admin selects never render empty. */
export function useCategories() {
  const [categories, setCategories] = useState<CategoryItem[]>(
    BOOK_CATEGORIES.map((name, index) => ({ id: -1 - index, name, book_count: 0 })),
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/categories');
      if (res.ok) {
        const data = (await res.json()) as CategoryItem[];
        if (data.length > 0) setCategories(data);
      }
    } catch {
      // keep fallback defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { categories, names: categories.map((c) => c.name), loading, refresh };
}
