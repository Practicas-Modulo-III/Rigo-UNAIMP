import { useEffect } from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';
import { resolveBackendUrl } from '@/services/api';

interface PDFViewerModalProps {
  pdfUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function PDFViewerModal({ pdfUrl, isOpen, onClose, title }: PDFViewerModalProps) {
  const viewerUrl = pdfUrl ? resolveBackendUrl(pdfUrl) : null;
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de PDF"
    >
      <div
        className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-emerald-400" />
            <h2 className="truncate text-sm font-bold text-white">{title ?? 'Visualizador de PDF'}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {viewerUrl ? (
              <a
                href={viewerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir en pestaña
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-500 opacity-50"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir en pestaña
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-3 py-1.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300"
            >
              <X className="h-4 w-4" />
              Cerrar
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 bg-slate-900">
          {viewerUrl ? (
            <iframe
              src={viewerUrl}
              title={title ?? 'Documento PDF'}
              className="h-full w-full"
              sandbox="allow-same-origin allow-scripts allow-popups allow-downloads"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-slate-400">
              <FileText className="h-10 w-10 text-slate-500" />
              <p className="text-sm font-medium text-slate-300">Este ejemplar no cuenta con PDF digitalizado.</p>
              <p className="max-w-sm text-xs leading-relaxed">
                La ficha móvil con la ubicación en estante y el código QR sigue disponible para este ejemplar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
