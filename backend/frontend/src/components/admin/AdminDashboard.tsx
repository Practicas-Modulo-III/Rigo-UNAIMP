import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowRight, BookOpen, CheckCircle2, Clock3, FileUp, LayoutDashboard, MapPinned, RefreshCw, ScanLine, ShieldCheck, Sparkles, Tag } from 'lucide-react';
import { apiFetch } from '@/services/api';
import { QueryStatsCard } from '@/components/admin/QueryStatsCard';
import { CategoryManagerModal } from '@/components/admin/CategoryManagerModal';

type AdminSection = 'dashboard' | 'ingestion' | 'inventory' | 'telemetry' | 'croquis';

interface DashboardData {
  books: number;
  available: number;
  queued: number;
  processing: number;
  vectors: number | null;
  mode: string | null;
}

interface AdminDashboardProps {
  onNavigate: (section: AdminSection) => void;
}

const initialData: DashboardData = { books: 0, available: 0, queued: 0, processing: 0, vectors: null, mode: null };

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [inventoryResponse, logsResponse, metricsResponse] = await Promise.all([
        apiFetch('/api/inventory/'),
        apiFetch('/api/documents/logs'),
        apiFetch('/api/system/metrics'),
      ]);
      const inventory = inventoryResponse.ok ? await inventoryResponse.json() as { total?: number; items?: Array<{ status: string }> } : null;
      const logs = logsResponse.ok ? await logsResponse.json() as { logs?: Array<{ status: string }> } : null;
      const metrics = metricsResponse.ok ? await metricsResponse.json() as { total_vectors?: number; mode?: string } : null;
      const items = inventory?.items ?? [];
      const ingestion = logs?.logs ?? [];
      setData({
        books: inventory?.total ?? items.length,
        available: items.filter((item) => item.status === 'available').length,
        queued: ingestion.filter((entry) => entry.status === 'queued').length,
        processing: ingestion.filter((entry) => entry.status === 'processing').length,
        vectors: metrics?.total_vectors ?? null,
        mode: metrics?.mode ?? null,
      });
      setUpdatedAt(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const cards = [
    { label: 'Ejemplares indexados', value: data.books, detail: 'Catálogo bibliográfico', icon: BookOpen, tone: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' },
    { label: 'Disponibles', value: data.available, detail: 'Listos para consulta', icon: CheckCircle2, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
    { label: 'En cola de ingesta', value: data.queued + data.processing, detail: data.processing ? `${data.processing} procesándose ahora` : 'Sin tareas en proceso', icon: ScanLine, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' },
    { label: 'Vectores RAG', value: data.vectors ?? '—', detail: 'nomic-embed-text · 768 dim.', icon: Sparkles, tone: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300' },
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#092844] via-[#0c3556] to-[#075e55] p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-emerald-200 ring-1 ring-inset ring-white/20"><ShieldCheck className="h-3.5 w-3.5" /> ADMINISTRACIÓN SEGURA</span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Centro de control bibliográfico</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200 sm:text-base">Gestione el catálogo, las digitalizaciones y la ubicación física de los fondos de la UNA Piura desde un solo lugar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-lg bg-slate-950/30 px-3 py-2 text-xs font-medium text-slate-100"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> {data.mode === 'on-premise' ? 'Modo local activo' : data.mode === 'cloud' ? 'Modo cloud activo' : 'Sistema conectado'}</span>
            <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-bold text-[#09324e] transition hover:bg-emerald-50 disabled:opacity-60"><RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} /> Actualizar</button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, detail, icon: Icon, tone }) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{loading ? '…' : value}</p></div><span className={'rounded-xl p-3 ' + tone}><Icon className="h-5 w-5" /></span></div><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{detail}</p></article>)}
      </div>

      <QueryStatsCard onViewReport={() => onNavigate('telemetry')} />

      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between"><div><p className="text-xs font-bold tracking-widest text-emerald-600 dark:text-emerald-400">OPERACIÓN DIARIA</p><h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Acciones rápidas</h3></div><LayoutDashboard className="h-5 w-5 text-slate-400" /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => onNavigate('ingestion')} className="group flex items-center gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:hover:bg-emerald-500/10"><span className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-300"><FileUp className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900 dark:text-white">Iniciar ingesta</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Subir PDF o escaneo</span></span><ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-600" /></button>
            <button type="button" onClick={() => onNavigate('inventory')} className="group flex items-center gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-indigo-500/10"><span className="rounded-lg bg-indigo-500/10 p-2.5 text-indigo-600 dark:text-indigo-300"><BookOpen className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900 dark:text-white">Actualizar inventario</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Estado de ejemplares</span></span><ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-indigo-600" /></button>
            <button type="button" onClick={() => onNavigate('croquis')} className="group flex items-center gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-rose-400 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-500/10"><span className="rounded-lg bg-rose-500/10 p-2.5 text-rose-600 dark:text-rose-300"><MapPinned className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900 dark:text-white">Editar croquis</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Ubicaciones y estantes</span></span><ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-rose-600" /></button>
            <button type="button" onClick={() => onNavigate('telemetry')} className="group flex items-center gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-amber-400 hover:bg-amber-50 dark:border-slate-700 dark:hover:bg-amber-500/10"><span className="rounded-lg bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-300"><Clock3 className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900 dark:text-white">Ver telemetría</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Salud del servidor</span></span><ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-amber-600" /></button>
            <button type="button" onClick={() => setManagingCategories(true)} className="group flex items-center gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-cyan-400 hover:bg-cyan-50 dark:border-slate-700 dark:hover:bg-cyan-500/10"><span className="rounded-lg bg-cyan-500/10 p-2.5 text-cyan-600 dark:text-cyan-300"><Tag className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900 dark:text-white">Gestionar categorías</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Agregar, renombrar o borrar</span></span><ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-cyan-600" /></button>
          </div>
        </article>
        <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-widest text-emerald-600 dark:text-emerald-400">ESTADO DEL FLUJO</p>
            <Activity className="h-5 w-5 text-slate-400" />
          </div>

          <div className="mt-5 flex-1 space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              <span className="mt-0.5 shrink-0 rounded-full bg-emerald-500/15 p-1.5 text-emerald-600 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Catálogo disponible</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{loading ? '…' : data.books}</span> registros listos para consulta en kiosco.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              <span className="mt-0.5 shrink-0 rounded-full bg-amber-500/15 p-1.5 text-amber-600 dark:text-amber-300"><ScanLine className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Procesamiento asíncrono</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {data.queued + data.processing > 0
                    ? `${data.queued + data.processing} documento(s) indexándose en segundo plano.`
                    : 'Sin documentos en cola; el kiosco permanece disponible.'}
                </p>
              </div>
            </div>
          </div>

          <p className="mt-5 flex items-center gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span className={'h-1.5 w-1.5 shrink-0 rounded-full ' + (updatedAt ? 'bg-emerald-500' : 'animate-pulse bg-amber-500')} />
            {updatedAt ? `Última lectura: ${updatedAt.toLocaleTimeString('es-PE')}` : 'Conectando con el servidor…'}
          </p>
        </article>
      </div>
      <CategoryManagerModal isOpen={managingCategories} onClose={() => setManagingCategories(false)} />
    </section>
  );
}
