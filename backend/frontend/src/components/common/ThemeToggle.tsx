import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_KEY = 'rigo-theme';

function getInitialDark(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored) return stored === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(() => {
    const initial = getInitialDark();
    window.document.documentElement.classList.toggle('dark', initial);
    return initial;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle('dark', dark);
    window.localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const root = window.document.documentElement;
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored) {
      root.classList.toggle('dark', stored === 'dark');
    }
  }, []);

  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      aria-label="Cambiar tema"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{dark ? 'Claro' : 'Oscuro'}</span>
    </button>
  );
}