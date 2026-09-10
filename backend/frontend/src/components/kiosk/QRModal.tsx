import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { BookOpen, Calendar, Copy, Download, MapPin, QrCode, Smartphone, User, X } from 'lucide-react';
import type { BookDoc, BookStatus } from '@/types';
import { BookStatusBadge } from '@/components/common/BookStatusBadge';
import { LibraryCroquisViewer } from '@/components/kiosk/LibraryCroquisViewer';

const STATUS_LABELS: Record<BookStatus, string> = {
  available: 'Disponible en Estante',
  in_use: 'En Uso',
  reserved: 'Reservado',
};

function pasilloLabel(pasillo: number): string {
  return pasillo > 0 ? `Pasillo ${pasillo}` : 'Archivo';
}

interface QRModalProps {
  book: BookDoc | null;
  isOpen: boolean;
  onClose: () => void;
  highlightPasillo?: number | null;
  highlightEstante?: string | null;
}

/** Copia de respaldo para contextos sin Clipboard API (http/see). */
function fallbackCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  return ok;
}

export function QRModal({
  book,
  isOpen,
  onClose,
  highlightPasillo = null,
  highlightEstante = null,
}: QRModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const pasillo = highlightPasillo ?? (book ? book.location.pasillo : null);
  const estante = highlightEstante ?? (book ? book.location.estante : null);

  const locationLabel = useMemo(() => {
    if (!book) return '';
    if (book.location.display) return book.location.display;
    const tag = book.location.tagCode ? ` (${book.location.tagCode})` : '';
    return `${pasilloLabel(book.location.pasillo)} — ${book.location.estante}${tag}`;
  }, [book]);

  const citation = useMemo(() => {
    if (!book) return '';
    return `[Fuente: ${book.title}] — ${pasilloLabel(book.location.pasillo)} — ${book.location.estante}, pág. ${book.page}.`;
  }, [book]);

  const fichaText = useMemo(() => {
    if (!book) return '';
    const status = STATUS_LABELS[book.status];
    return [
      'FICHA BIBLIOGRÁFICA — RIGO | UNA Piura',
      `Código de catálogo: ${book.id}`,
      `Título: ${book.title}`,
      `Autor: ${book.author}`,
      `Año: ${book.year}`,
      `Categoría: ${book.category}`,
      `Ubicación: ${locationLabel}`,
      `Estado: ${status}`,
      book.returnTime ? `Devolución estimada: ${book.returnTime}` : '',
      `Síntesis: ${book.rigoSummary}`,
      `Cita: ${citation}`,
    ]
      .filter((line) => line !== '')
      .join('\n');
  }, [book, citation, locationLabel]);

  const handleCopy = useCallback(async () => {
    if (!fichaText) return;
    const markCopied = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    };
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fichaText);
      } else if (!fallbackCopy(fichaText)) {
        return;
      }
      markCopied();
    } catch {
      if (!fallbackCopy(fichaText)) return;
      markCopied();
    }
  }, [fichaText]);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const fileName = `RIGO-QR-${(book?.id ?? 'ficha').replace(/\s+/g, '_')}.png`;
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [book]);

  if (!isOpen || !book) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Ficha de ubicación de ejemplar"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-800 bg-slate-900 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
              <Smartphone className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-bold text-white">Ficha Móvil &amp; Código QR</h2>
                <span className="rounded bg-emerald-400/10 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-400">
                  {book.id}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                Escanea desde tu smartphone para llevar la ubicación física y resumen a la sala de lectura.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[13rem_minmax(0,1fr)]">
          {/* Columna izquierda: código QR */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center rounded-xl border border-slate-800 bg-white p-4">
              <QRCodeCanvas
                ref={canvasRef}
                value={fichaText}
                size={180}
                level="M"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#020617"
                title="Ficha bibliográfica RIGO UNA Piura"
              />
            </div>
            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
              <QrCode className="h-3.5 w-3.5 shrink-0" />
              Format: QR-Code ISO 18004 · Local
            </p>
            <p className="text-center text-[11px] text-slate-500">Compatible con la App de Biblioteca UNA Piura.</p>
          </div>

          {/* Columna derecha: ficha del libro */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="min-w-0 text-lg font-bold leading-snug text-white">{book.title}</h3>
              <span className="shrink-0 rounded bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300">{book.category}</span>
            </div>

            <div>
              <BookStatusBadge status={book.status} />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                {book.author}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                Año: {book.year}
              </span>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <p>
                <span className="font-semibold text-rose-300">Ubicación Física:</span> {locationLabel}
              </p>
            </div>

            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                Síntesis redactada por RIGO
              </p>
              <p className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm italic leading-relaxed text-slate-300">
                &ldquo;{book.rigoSummary}&rdquo;
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Ubicación en croquis 2D</p>
              {/* El visor ya se adapta al ancho disponible; en modo compacto muestra solo el
                  mapa (sin pestañas ni listado de stands), que es lo que cabe en esta columna. */}
              <LibraryCroquisViewer
                compact
                highlightPasillo={pasillo}
                highlightEstante={estante}
                onSelectShelf={() => undefined}
              />
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-900 px-5 py-3">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <BookOpen className="h-3.5 w-3.5 shrink-0" />
            Biblioteca Central UNA Piura · Sala de Lectura
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Ficha copiada' : 'Copiar Ficha'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300"
            >
              <Download className="h-4 w-4" />
              Descargar QR
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
