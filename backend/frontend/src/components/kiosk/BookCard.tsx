import { MapPin, FileText, Library } from 'lucide-react';
import type { BookDoc } from '@/types';
import { BookStatusBadge } from '@/components/common/BookStatusBadge';

interface BookCardProps {
  book: BookDoc;
  onViewLocation?: (book: BookDoc) => void;
  onViewPdf?: (book: BookDoc) => void;
}

export function BookCard({ book, onViewLocation, onViewPdf }: BookCardProps) {
  return (
<article className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-colors hover:border-emerald-500/40 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold leading-snug text-slate-900 dark:text-white" title={book.title}>
            {book.title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{book.author}</p>
        </div>
        <BookStatusBadge status={book.status} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 font-mono font-semibold text-emerald-500 dark:text-emerald-400">
          {book.id}
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{book.category}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{book.year}</span>
      </div>

      <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{book.rigoSummary}</p>

      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => onViewLocation?.(book)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-emerald-600 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-emerald-400 hover:text-slate-950 dark:bg-slate-950 dark:text-emerald-400 dark:ring-emerald-500/30"
        >
          <MapPin className="h-3.5 w-3.5" />
          Ficha y ubicación
        </button>
        <button
          type="button"
          onClick={() => onViewPdf?.(book)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {book.pdfUrl ? <FileText className="h-3.5 w-3.5" /> : <Library className="h-3.5 w-3.5" />}
          {book.pdfUrl ? 'PDF' : 'Solo en sala'}
        </button>
      </div>
    </article>
  );
}
