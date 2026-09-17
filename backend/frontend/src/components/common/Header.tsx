import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  title?: string;
  kiosk?: boolean;
}

export function Header({ title = 'RIGO — Asistente de Consulta Bibliográfica', kiosk = false }: HeaderProps) {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <header className="w-full bg-white text-slate-900 shadow-lg transition-colors duration-300 dark:bg-[#0a2540] dark:text-white">
      <div className="border-b-4 border-[#e11d48]">
        {/* flex-nowrap a propósito: el bloque izquierdo (logo+título) trunca con min-w-0 en vez
            de envolver — así el grupo derecho (reloj, tema, admin) nunca cae a su propia fila
            suelta como pasaba antes con el botón de tema. */}
        <div className="mx-auto flex max-w-7xl flex-nowrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/kiosk')}
              aria-label="Ir al chat de estudiantes"
              className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <img src="/logo-una.png" alt="Logo UNA Piura" className="h-12 w-12 rounded-full" />
            </button>
            <div className="min-w-0">
              {/* Sin truncate: en pantallas angostas el texto se lee completo achicando la
                  letra, en vez de cortarse con "...". */}
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm font-bold leading-tight sm:text-lg lg:text-xl">{title}</h1>
                {kiosk ? (
                  <span className="shrink-0 rounded-full bg-emerald-400 px-2.5 py-0.5 text-[11px] font-bold uppercase leading-none text-slate-950">
                    KIOSKO LAN K1
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-100/80 sm:text-sm">
                Universidad Nacional de Arte «Ignacio Merino» — UNA Piura
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
            <div className="hidden text-right lg:block">
              <div className="font-mono text-lg font-semibold tabular-nums">{time}</div>
              <div className="text-sm capitalize text-emerald-700/70 dark:text-emerald-100/70">{date}</div>
            </div>
            {kiosk ? (
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                SYSTEM OK
              </span>
            ) : null}
            {kiosk ? (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#e11d48] px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-[#be123c]"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Acceder Panel Admin</span>
              </button>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}