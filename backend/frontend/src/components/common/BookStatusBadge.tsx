import type { BookStatus } from '@/types';

const CONFIG: Record<BookStatus, { label: string; cls: string }> = {
  available: { label: 'Disponible en Estante', cls: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30' },
  in_use: { label: 'En Uso', cls: 'bg-amber-500/15 text-amber-400 ring-amber-500/30' },
  reserved: { label: 'Reservado', cls: 'bg-rose-500/15 text-rose-400 ring-rose-500/30' },
};

interface BookStatusBadgeProps {
  status: BookStatus;
}

export function BookStatusBadge({ status }: BookStatusBadgeProps) {
  const cfg = CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.cls}`}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  );
}
