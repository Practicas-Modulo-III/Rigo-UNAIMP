import { FormEvent, useState } from 'react';
import { AlertCircle, Check, Loader2, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { apiFetch } from '@/services/api';
import { useCategories } from '@/hooks/useCategories';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CategoryManagerModal({ isOpen, onClose }: CategoryManagerModalProps) {
  const { categories, refresh } = useCategories();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  if (!isOpen) return null;

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    setBusyId(-999);
    try {
      const res = await apiFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail || 'No se pudo crear la categoría');
        return;
      }
      setNewName('');
      refresh();
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (id: number, name: string) => {
    setEditingId(id);
    setEditingName(name);
    setError(null);
  };

  const handleRename = async (id: number) => {
    if (!editingName.trim()) return;
    setError(null);
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail || 'No se pudo renombrar la categoría');
        return;
      }
      setEditingId(null);
      refresh();
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    setError(null);
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail || `No se pudo borrar "${name}"`);
        return;
      }
      refresh();
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 dark:bg-slate-950 dark:border-slate-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Tag className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Gestionar Categorías
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nueva categoría"
              maxLength={100}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
            />
            <button
              type="submit"
              disabled={busyId === -999 || !newName.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
            >
              {busyId === -999 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Agregar
            </button>
          </form>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            </div>
          ) : null}

          <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 max-h-80 overflow-y-auto">
            {categories.map((cat) => (
              <li key={cat.id} className="flex items-center gap-2 px-3 py-2.5">
                {editingId === cat.id ? (
                  <>
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                      maxLength={100}
                      className="flex-1 rounded-lg border border-emerald-400 bg-white dark:bg-slate-900 px-2 py-1 text-sm text-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(cat.id)}
                      disabled={busyId === cat.id}
                      className="rounded-lg p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                      aria-label="Guardar"
                    >
                      {busyId === cat.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label="Cancelar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">{cat.name}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {cat.book_count} {cat.book_count === 1 ? 'ejemplar' : 'ejemplares'}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(cat.id, cat.name)}
                      className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label={`Renombrar ${cat.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id, cat.name)}
                      disabled={cat.book_count > 0 || busyId === cat.id}
                      title={cat.book_count > 0 ? 'No se puede borrar: hay ejemplares con esta categoría' : 'Borrar'}
                      className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                      aria-label={`Borrar ${cat.name}`}
                    >
                      {busyId === cat.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end border-t border-slate-200 dark:border-slate-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
