import { useCallback, useEffect, useState } from 'react';
import { Cpu, HardDrive, Database, Server, Activity, AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';

export interface SystemMetrics {
  cpu_percent: number;
  memory: {
    total_mb: number;
    available_mb: number;
    percent: number;
  };
  disk: {
    total_gb: number;
    free_gb: number;
    percent: number;
  };
  platform: string;
  ollama_status: {
    available: boolean;
  };
  vector_provider: string;
}

interface TelemetryCardProps {
  authToken: string | null;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function TelemetryCard({ authToken, autoRefresh = true, refreshInterval = 10000 }: TelemetryCardProps) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/system/metrics', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
        setError(null);
      } else {
        setError('Error al obtener métricas');
      }
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchMetrics();
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchMetrics, autoRefresh, refreshInterval]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'stopped':
      case 'disconnected':
        return <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return <Activity className="h-4 w-4 text-slate-500 dark:text-slate-400" />;
    }
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'text-red-600 dark:text-red-400';
    if (percent >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  const MetricCard = ({
    icon: Icon,
    label,
    value,
    unit = '',
    color = 'text-slate-900 dark:text-white',
    trend,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: number | string;
    unit?: string;
    color?: string;
    trend?: 'up' | 'down' | 'stable';
  }) => (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend === 'up' ? 'text-red-600 dark:text-red-400' : trend === 'down' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        {unit && <span className="text-sm text-slate-400 dark:text-slate-500">{unit}</span>}
      </div>
    </div>
  );

  if (loading && !metrics) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 dark:bg-slate-950 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Telemetría del Sistema
          </h2>
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 animate-pulse">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
              <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 dark:bg-slate-950 dark:border-slate-800 p-6 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-600 dark:text-red-400 mb-4" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Error al cargar telemetría</h3>
        <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
        <button
          onClick={fetchMetrics}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-300"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  const memPercent = metrics.memory.percent;
  const cpuPercent = metrics.cpu_percent;
  const diskPercent = metrics.disk.percent;
  const memUsedGb = (metrics.memory.total_mb - metrics.memory.available_mb) / 1024;
  const memTotalGb = metrics.memory.total_mb / 1024;
  const diskUsedGb = metrics.disk.total_gb - metrics.disk.free_gb;
  const ollamaOk = metrics.ollama_status.available;
  const chromaStatus = metrics.vector_provider === 'chromadb' ? 'connected' : 'disconnected';
  const pineconeStatus = metrics.vector_provider === 'pinecone' ? 'connected' : 'disconnected';

  return (
    <div className="rounded-2xl bg-white border border-slate-200 dark:bg-slate-950 dark:border-slate-800 overflow-hidden">
      <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Telemetría del Sistema
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">Actualizado: {new Date().toLocaleTimeString('es-PE')}</span>
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={Cpu}
            label="CPU"
            value={`${cpuPercent.toFixed(1)}%`}
            color={getUsageColor(cpuPercent)}
          />
          <MetricCard
            icon={HardDrive}
            label="RAM"
            value={`${memPercent.toFixed(1)}%`}
            unit={`(${memUsedGb.toFixed(1)} / ${memTotalGb.toFixed(1)} GB)`}
            color={getUsageColor(memPercent)}
          />
          <MetricCard
            icon={Database}
            label="Disco"
            value={`${diskPercent.toFixed(1)}%`}
            unit={`(${diskUsedGb.toFixed(1)} / ${metrics.disk.total_gb.toFixed(1)} GB)`}
            color={getUsageColor(diskPercent)}
          />
          <MetricCard
            icon={Server}
            label="Plataforma"
            value={metrics.platform}
            color="text-slate-900 dark:text-white"
          />
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Servicios Críticos
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex-shrink-0">{getStatusIcon(ollamaOk ? 'running' : 'error')}</div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Ollama</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{ollamaOk ? 'Disponible' : 'No disponible'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex-shrink-0">{getStatusIcon(chromaStatus)}</div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">ChromaDB</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{chromaStatus}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex-shrink-0">{getStatusIcon(pineconeStatus)}</div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Pinecone</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{pineconeStatus}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex-shrink-0"><Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Vector Provider</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{metrics.vector_provider}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}