import { FormEvent, useState } from 'react';
import { AlertCircle, FileText, Loader2, MapPin, Play, Search, ShieldCheck, X } from 'lucide-react';
import { apiFetch } from '@/services/api';

interface VectorInspectResult {
  chunk_id: string;
  catalog_code: string;
  title: string;
  page: number;
  similarity: number;
  match_label: 'High Match' | 'Moderate Match' | 'Low Match';
  pasillo: number | null;
  estante: string;
  location_tag: string;
  excerpt: string;
  chunk_chars: number;
  chunk_max_chars: number;
}

interface VectorInspectResponse {
  query: string;
  embedding_model: string;
  embedding_dimensions: number;
  vector_provider: string;
  distance_metric: string;
  llm_model: string;
  mode: 'cloud' | 'on-premise';
  results: VectorInspectResult[];
}

interface VectorInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
}

const MATCH_STYLES: Record<VectorInspectResult['match_label'], string> = {
  'High Match': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
  'Moderate Match': 'bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-inset ring-sky-500/30',
  'Low Match': 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/30',
};

export function VectorInspectorModal({ isOpen, onClose, authToken }: VectorInspectorModalProps) {
  const [question, setQuestion] = useState('¿Dónde está el Tratado de la Pintura y del Paisaje?');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<VectorInspectResponse | null>(null);
  const [selected, setSelected] = useState<VectorInspectResult | null>(null);

  const runTest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken || !question.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await apiFetch('/api/system/vector-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.detail || 'Error al ejecutar el similarity test');
        return;
      }
      const data = (await res.json()) as VectorInspectResponse;
      setResponse(data);
      setSelected(data.results[0] ?? null);
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setRunning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 dark:bg-slate-950 dark:border-slate-800 shadow-xl">
        <div className="border-b-4 border-[#e11d48]">
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                <Search className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Inspector de Búsqueda Vectorial &amp; Similarity Test</h2>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {response
                    ? `${response.vector_provider.toUpperCase()} · MÉTRICA: ${response.distance_metric.toUpperCase()}`
                    : 'CHROMADB / PINECONE · MÉTRICA: COSINE'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4 flex-shrink-0" />
              Hallucination Guardrail Active:
              <span className="font-normal text-emerald-700/80 dark:text-emerald-300/80">
                {response
                  ? `Modelo: ${response.llm_model} · Contexto inyectado: ${response.results.length > 0 ? 'TRUE' : 'FALSE'}`
                  : 'Temperatura 0.1 en modo cloud · Contexto RAG obligatorio'}
              </span>
            </div>
            <span className="rounded-md border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Strict RAG Filter Mode
            </span>
          </div>

          <form onSubmit={runTest} className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Simulador de consulta de estudiante (vector query)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="¿Dónde está el Tratado de la Pintura y del Paisaje?"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                />
              </div>
              <button
                type="submit"
                disabled={running || !question.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-300 disabled:opacity-50"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Ejecutar Similarity Test
              </button>
            </div>
          </form>

          {error ? (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-2.5">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Top 3 chunks vectoriales ({response ? response.embedding_model : 'nomic-embed-text'})
              </span>
              <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">Distance Threshold: &gt; 0.60</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300">Chunk ID</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300">Documento fuente</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300">Pág.</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300">Cosine similarity</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-300">Ubicación física</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-600 dark:text-slate-300">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {!response ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-400 dark:text-slate-500" colSpan={6}>
                        Ejecute una consulta para ver los chunks recuperados del vector store.
                      </td>
                    </tr>
                  ) : response.results.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-400 dark:text-slate-500" colSpan={6}>
                        Sin coincidencias sobre el umbral de similitud.
                      </td>
                    </tr>
                  ) : (
                    response.results.map((item) => (
                      <tr
                        key={item.chunk_id}
                        className={
                          'border-t border-slate-100 dark:border-slate-800/50 ' +
                          (selected?.chunk_id === item.chunk_id ? 'bg-emerald-500/5' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50')
                        }
                      >
                        <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">{item.catalog_code}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{item.title}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono">{item.page}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${MATCH_STYLES[item.match_label]}`}>
                            Score: {item.similarity.toFixed(2)} · {item.match_label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                            Pasillo {item.pasillo ?? '—'} - Estante {item.estante || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelected(item)}
                            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            Ver extracto
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selected ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  {selected.catalog_code} — {selected.title} (Pág {selected.page})
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                  <MapPin className="h-3.5 w-3.5" />
                  Pasillo {selected.pasillo ?? '—'} - Estante {selected.estante || '—'}
                </span>
              </div>
              <div className="px-4 py-4">
                <p className="rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 font-mono text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
                  &quot;...{selected.excerpt}...&quot;
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4 text-xs">
                <span className="text-slate-400 dark:text-slate-500">
                  Caracteres en chunk: {selected.chunk_chars} / {selected.chunk_max_chars}
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Inyectado en prompt de {response?.llm_model ?? 'RIGO'}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-slate-200 dark:border-slate-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-300"
          >
            Cerrar Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
