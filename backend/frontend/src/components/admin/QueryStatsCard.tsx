import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Zap, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/services/api';

interface TopTopic {
  category: string;
  count: number;
  percent: number;
}

interface QueryStats {
  queries_today: number;
  avg_response_seconds: number;
  top_topics: TopTopic[];
}

const initialStats: QueryStats = { queries_today: 0, avg_response_seconds: 0, top_topics: [] };
const BAR_COLORS = ['bg-emerald-500', 'bg-rose-500', 'bg-slate-400'];
const VALUE_COLORS = ['text-emerald-400', 'text-rose-400', 'text-slate-300'];

interface QueryStatsCardProps {
  onViewReport?: () => void;
}

export function QueryStatsCard({ onViewReport }: QueryStatsCardProps) {
  const [stats, setStats] = useState<QueryStats>(initialStats);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await apiFetch('/api/system/query-stats');
      if (response.ok) setStats(await response.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-[#0b1f3a] p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white/10 p-2.5 text-slate-200"><MessageSquare className="h-5 w-5" /></span>
            <span className="text-xs font-bold tracking-widest text-slate-300">CONSULTAS HOY</span>
          </div>
          <p className="mt-3 text-3xl font-bold italic text-white">{loading ? '…' : stats.queries_today}</p>
        </div>
        <div className="rounded-2xl bg-[#0b1f3a] p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-rose-500/20 p-2.5 text-rose-400"><Zap className="h-5 w-5" /></span>
            <span className="text-xs font-bold tracking-widest text-slate-300">RESPUESTA PROMEDIO</span>
          </div>
          <p className="mt-3 text-3xl font-bold italic text-white">{loading ? '…' : `${stats.avg_response_seconds}s`}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-[#0b1f3a] p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Temas de Arte más Consultados</h3>
          {onViewReport && (
            <button type="button" onClick={onViewReport} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300">
              VER REPORTE DETALLADO <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="mt-6 space-y-5">
          {stats.top_topics.length === 0 && !loading && (
            <p className="text-sm text-slate-400">Aún no hay consultas registradas.</p>
          )}
          {stats.top_topics.map((topic, index) => (
            <div key={topic.category}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-200">{topic.category}</span>
                <span className={'font-bold ' + (VALUE_COLORS[index] ?? 'text-slate-300')}>{topic.percent}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-700/50">
                <div className={'h-full rounded-full ' + (BAR_COLORS[index] ?? 'bg-slate-400')} style={{ width: `${topic.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
