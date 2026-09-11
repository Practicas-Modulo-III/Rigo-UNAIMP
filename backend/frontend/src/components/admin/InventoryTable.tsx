import { useCallback, useEffect, useState } from 'react';
import { Edit2, Save, X, Loader2, AlertCircle, CheckCircle, Package, Trash2 } from 'lucide-react';
import { apiFetch } from '@/services/api';

export interface InventoryItem {
  code: string;
  title: string;
  author: string;
  year: number;
  // La ubicación se guarda en sus tres piezas, no como el texto compuesto que se muestra:
  // ese texto no se puede volver a separar de forma fiable para guardarlo.
  pasillo: number;
  estante: string;
  locationTag: string;
  quantity: number;
  status: 'available' | 'in_use' | 'reserved';
}

interface InventoryApiItem {
  catalog_code: string;
  title: string;
  author: string;
  year: number;
  pasillo: number;
  estante: string;
  location_tag: string;
  status: InventoryItem['status'];
  quantity?: number;
}

const locationLabel = (item: InventoryItem) =>
  `Pasillo ${item.pasillo} · Estante ${item.estante} (${item.locationTag})`;

interface InventoryTableProps {
  authToken: string | null;
}

export function InventoryTable({ authToken }: InventoryTableProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchInventory = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/inventory/');
      if (res.ok) {
        const data = await res.json() as { items?: InventoryApiItem[] };
        setItems((data.items ?? []).map((item) => ({
          code: item.catalog_code,
          title: item.title,
          author: item.author,
          year: item.year,
          pasillo: item.pasillo,
          estante: item.estante,
          locationTag: item.location_tag,
          quantity: item.quantity ?? 1,
          status: item.status,
        })));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingId(item.code);
    setEditForm({
      title: item.title,
      author: item.author,
      year: item.year,
      pasillo: item.pasillo,
      estante: item.estante,
      locationTag: item.locationTag,
      quantity: item.quantity,
      status: item.status,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (code: string) => {
    if (!authToken) {
      showToast('Token de autenticación requerido', 'error');
      return;
    }

    setSaving({ ...saving, [code]: true });
    try {
      const res = await apiFetch(`/api/inventory/${encodeURIComponent(code)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          author: editForm.author,
          year: editForm.year,
          pasillo: editForm.pasillo,
          estante: editForm.estante,
          location_tag: editForm.locationTag,
          quantity: editForm.quantity,
          status: editForm.status,
        }),
      });
      if (res.ok) {
        showToast('Ejemplar actualizado correctamente', 'success');
        setEditingId(null);
        fetchInventory();
      } else {
        const data = await res.json();
        showToast(data.detail || 'Error al actualizar', 'error');
      }
    } catch {
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setSaving({ ...saving, [code]: false });
    }
  };

  const handleDelete = async (code: string) => {
    setDeleting((current) => ({ ...current, [code]: true }));
    try {
      const res = await apiFetch(`/api/inventory/${encodeURIComponent(code)}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        const pieces = [`${data.vectors_removed} fragmento(s) indexados`];
        if (data.pdf_removed) pieces.push('su PDF');
        showToast(`Ejemplar ${code} eliminado junto con ${pieces.join(' y ')}`, 'success');
        setConfirmDelete(null);
        fetchInventory();
      } else {
        showToast(data.detail || 'Error al eliminar el ejemplar', 'error');
      }
    } catch {
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setDeleting((current) => ({ ...current, [code]: false }));
    }
  };

  const getStatusBadge = (status: 'available' | 'in_use' | 'reserved') => (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        status === 'available'
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : status === 'in_use'
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
      }`}
    >
      {status === 'available'
        ? 'Disponible en Estante'
        : status === 'in_use'
          ? 'En Uso'
          : 'Reservado'}
    </span>
  );

  return (
    <div className="rounded-2xl bg-white border border-slate-200 dark:bg-slate-950 dark:border-slate-800 overflow-hidden">
      <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Inventario de Ejemplares
        </h2>
      </div>

      {toast && (
        <div
          className={`mx-4 mt-4 rounded-lg border px-4 py-3 flex items-center gap-3 ${
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
              : 'border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Código</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Título</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Autor</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Año</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Ubicación</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Cant.</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Disponibilidad</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400 dark:text-slate-500" colSpan={8}>
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400 dark:text-slate-500" colSpan={8}>
                  No hay ejemplares registrados
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.code} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  {editingId === item.code ? (
                    <>
                      <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400">{item.code}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editForm.title || ''}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-900 dark:text-white text-sm focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editForm.author || ''}
                          onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-900 dark:text-white text-sm focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={editForm.year || ''}
                          onChange={(e) => setEditForm({ ...editForm, year: parseInt(e.target.value) || 0 })}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-900 dark:text-white text-sm focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-[240px] gap-1.5">
                          <input
                            type="number"
                            min={0}
                            max={3}
                            title="Pasillo"
                            value={editForm.pasillo ?? 0}
                            onChange={(e) => setEditForm({ ...editForm, pasillo: parseInt(e.target.value) || 0 })}
                            className="w-16 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-slate-900 dark:text-white text-sm focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                          />
                          <input
                            type="text"
                            title="Estante"
                            placeholder="Estante"
                            value={editForm.estante || ''}
                            onChange={(e) => setEditForm({ ...editForm, estante: e.target.value })}
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-slate-900 dark:text-white text-sm focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                          />
                          <input
                            type="text"
                            title="Código de etiqueta"
                            placeholder="P1-EA"
                            value={editForm.locationTag || ''}
                            onChange={(e) => setEditForm({ ...editForm, locationTag: e.target.value })}
                            className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 font-mono text-slate-900 dark:text-white text-sm focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={1}
                          value={editForm.quantity ?? 1}
                          onChange={(e) => setEditForm({ ...editForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-slate-900 dark:text-white text-sm focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={editForm.status || 'available'}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'available' | 'in_use' | 'reserved' })}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-900 dark:text-white text-sm focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                        >
                          <option value="available">Disponible en Estante</option>
                          <option value="in_use">En Uso</option>
                          <option value="reserved">Reservado</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleSave(item.code)}
                            disabled={saving[item.code]}
                            className="rounded-lg p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-400/10 transition-colors disabled:opacity-50"
                            aria-label="Guardar"
                          >
                            {saving[item.code] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancel}
                            className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                            aria-label="Cancelar"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400">{item.code}</td>
                      <td className="px-4 py-3 text-slate-900 dark:text-white max-w-xs truncate" title={item.title}>{item.title}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.author}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono">{item.year}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{locationLabel(item)}</td>
                      <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">
                        {String(item.quantity).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                      <td className="px-4 py-3 text-right">
                        {confirmDelete === item.code ? (
                          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                            <span className="text-xs text-red-600 dark:text-red-400">¿Eliminar ficha, PDF e índice?</span>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.code)}
                              disabled={deleting[item.code]}
                              className="inline-flex items-center gap-1 rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                            >
                              {deleting[item.code] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                              Confirmar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(item)}
                              className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                              aria-label="Editar ejemplar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(item.code)}
                              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                              aria-label="Eliminar ejemplar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {items.length} ejemplar{items.length !== 1 ? 'es' : ''} en total
        </p>
        <button
          onClick={fetchInventory}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>
    </div>
  );
}
