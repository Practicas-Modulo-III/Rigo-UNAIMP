import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import type { LucideIcon } from 'lucide-react';
import { Activity, ArrowLeft, BookOpen, Columns2, FileUp, KeyRound, LayoutDashboard, LogOut, Map, MapPinned, Menu, MessageSquare, Search, Send, SlidersHorizontal, X } from 'lucide-react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { Header } from '@/components/common/Header';
import { PDFIngestionModal } from '@/components/admin/PDFIngestionModal';
import { InventoryTable } from '@/components/admin/InventoryTable';
import { TelemetryCard } from '@/components/admin/TelemetryCard';
import { VectorInspectorModal } from '@/components/admin/VectorInspectorModal';
import { CredentialsPanel } from '@/components/admin/CredentialsPanel';
import { CroquisEditor } from '@/components/croquis/CroquisEditor';
import { AdvancedSearchFilters } from '@/components/kiosk/AdvancedSearchFilters';
import { ChatMessageList } from '@/components/kiosk/ChatMessageList';
import { LibraryCroquisViewer } from '@/components/kiosk/LibraryCroquisViewer';
import { PDFViewerModal } from '@/components/kiosk/PDFViewerModal';
import { QRModal } from '@/components/kiosk/QRModal';
import { CroquisProvider, useCroquisContext } from '@/context/CroquisContext';
import { SUGGESTED_QUESTIONS } from '@/data/demoQueries';
import { useRigoChat } from '@/hooks/useRigoChat';
import { apiFetch } from '@/services/api';
import { setToken, useAuthToken } from '@/services/auth';
import type { BookDoc, SearchFilters } from '@/types';

const initialFilters: SearchFilters = { category: 'Todas', pasillo: 'Todos', yearStart: 1900, yearEnd: 2030 };
type AdminTab = 'dashboard' | 'ingestion' | 'inventory' | 'telemetry' | 'croquis' | 'vector-inspector' | 'credentials';
type ViewMode = 'chat' | 'croquis' | 'split';

const SUGGESTIONS = SUGGESTED_QUESTIONS;

function KioskPage() {
  const { messages, isStreaming, sendMessage, clear } = useRigoChat();
  const { shelves } = useCroquisContext();
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [question, setQuestion] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookDoc | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const highlight = useMemo(() => [...messages].reverse().find((message) => message.sender === 'rigo' && message.highlightedPasillo), [messages]);
  const pasillo = selectedBook?.location.pasillo ?? highlight?.highlightedPasillo ?? null;
  const estante = selectedBook?.location.estante ?? highlight?.highlightedEstante ?? null;
  const handleViewLocation = (book: BookDoc) => { setSelectedBook(book); setIsQrOpen(true); };
  const handleViewPdf = (book: BookDoc) => { setPdfUrl(book.pdfUrl ?? null); setIsPdfOpen(true); };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(question, filters);
    setQuestion('');
  };
  const viewButton = (mode: ViewMode, label: string, Icon: LucideIcon, displayClassName = 'inline-flex') => (
    <button
      key={mode}
      type="button"
      onClick={() => setViewMode(mode)}
      className={
        displayClassName +
        ' items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ' +
        (viewMode === mode ? 'bg-emerald-500 text-slate-950' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white')
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  // "Vista Dividida" no cabe bien en pantallas angostas (chat + croquis lado a lado se ven
  // apretados y con scroll horizontal) — se oculta el botón y, si el usuario ya la tenía
  // seleccionada al achicar la ventana, se cae de vuelta a "Solo Chat".
  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 639px)');
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) setViewMode((current) => (current === 'split' ? 'chat' : current));
    };
    handleChange(mobileQuery);
    mobileQuery.addEventListener('change', handleChange);
    return () => mobileQuery.removeEventListener('change', handleChange);
  }, []);
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 transition-colors duration-300 dark:bg-slate-950">
      <Header kiosk />

      <div className="border-b border-slate-200 bg-white transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Terminal Kiosco RIGO <span className="mx-1 text-slate-400 dark:text-slate-600">·</span>{' '}
            <span className="text-slate-500 dark:text-slate-400">Sala de Lectura UNA Piura</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-100 p-1 ring-1 ring-inset ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
              {viewButton('chat', 'Solo Chat', MessageSquare)}
              {viewButton('croquis', 'Solo Croquis', Map)}
              {viewButton('split', 'Vista Dividida', Columns2, 'hidden sm:inline-flex')}
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-emerald-600 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-emerald-400 hover:text-slate-950 dark:bg-slate-950 dark:text-emerald-400 dark:ring-emerald-500/30"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros Avanzados
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 pb-4 pt-4">
        {filtersOpen ? (
          <AdvancedSearchFilters filters={filters} onFiltersChange={setFilters} onClose={() => setFiltersOpen(false)} />
        ) : null}

        {viewMode === 'chat' ? (
          <section className="flex flex-1 justify-center">
            <div className="flex h-[60vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:h-[70vh]">
              <ChatMessageList messages={messages} isStreaming={isStreaming} onViewLocation={handleViewLocation} onViewPdf={handleViewPdf} />
            </div>
          </section>
        ) : null}

        {viewMode === 'croquis' ? (
          <section className="flex-1">
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <LibraryCroquisViewer shelves={shelves} highlightPasillo={pasillo} highlightEstante={estante} onSelectShelf={() => undefined} />
            </div>
          </section>
        ) : null}

        {viewMode === 'split' ? (
          <section className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="flex h-[55vh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:h-[70vh]">
              <ChatMessageList messages={messages} isStreaming={isStreaming} onViewLocation={handleViewLocation} onViewPdf={handleViewPdf} />
            </div>
            <aside className="flex flex-col gap-4">
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <LibraryCroquisViewer shelves={shelves} highlightPasillo={pasillo} highlightEstante={estante} onSelectShelf={() => undefined} />
              </div>
            </aside>
          </section>
        ) : null}
      </main>

      <footer className="border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-3">
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Consultas de demostración:</span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setQuestion(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-emerald-600 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-emerald-400 hover:text-slate-950 dark:bg-slate-900 dark:text-emerald-400 dark:ring-emerald-500/20"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Escriba su consulta..."
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
              disabled={isStreaming}
            />
            <div className="flex shrink-0 gap-2">
              <button
                type="submit"
                disabled={isStreaming || !question.trim()}
                className="inline-flex flex-1 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:opacity-50 sm:flex-initial"
              >
                <Send className="h-4 w-4" />
                Consultar RIGO
              </button>
              <button
                type="button"
                onClick={clear}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Limpiar
              </button>
            </div>
          </form>
        </div>
      </footer>

      <QRModal
        book={selectedBook}
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        highlightPasillo={pasillo}
        highlightEstante={estante}
      />
      <PDFViewerModal pdfUrl={pdfUrl} isOpen={isPdfOpen} onClose={() => setIsPdfOpen(false)} title={selectedBook?.title} />
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    const response = await apiFetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    if (!response.ok) { setError('Credenciales inválidas.'); return; }
    const payload = await response.json() as { access_token: string };
    setToken(payload.access_token);
    navigate('/admin', { replace: true });
  };
  return (
    <>
      <Header />
      <main className="mx-auto max-w-md p-6">
        <button
          type="button"
          onClick={() => navigate('/kiosk')}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-emerald-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al chat
        </button>
        <form
          onSubmit={(event) => void submit(event)}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        >
          <h2 className="text-xl font-bold">Ingreso administrativo</h2>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Usuario"
            className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Contraseña"
            className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <button className="w-full rounded-lg bg-emerald-400 p-3 font-semibold text-slate-950">Ingresar</button>
        </form>
      </main>
    </>
  );
}

function AdminPage({ authToken }: { authToken: string }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { shelves, selectedId, setSelected, updateShelf, addShelf, deleteShelf, saveLayout, isDirty } = useCroquisContext();
  const [croquisSaveError, setCroquisSaveError] = useState<string | null>(null);
  const tabs: Array<{ id: AdminTab; label: string; description: string; icon: LucideIcon }> = [
    { id: 'dashboard', label: 'Resumen', description: 'Vista general', icon: LayoutDashboard },
    { id: 'ingestion', label: 'Ingesta digital', description: 'PDF y OCR', icon: FileUp },
    { id: 'inventory', label: 'Inventario', description: 'Ejemplares físicos', icon: BookOpen },
    { id: 'croquis', label: 'Croquis 2D', description: 'Estantes y pasillos', icon: MapPinned },
    { id: 'telemetry', label: 'Telemetría', description: 'Salud del sistema', icon: Activity },
    { id: 'vector-inspector', label: 'Inspector Vectorial', description: 'RAG y similarity test', icon: Search },
    { id: 'credentials', label: 'Credenciales', description: 'Usuario y contraseña', icon: KeyRound },
  ];
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const logout = () => {
    setToken(null);
    navigate('/login', { replace: true });
  };
  const selectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  const navContent = (
    <nav aria-label="Navegación administrativa" className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-5">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 pb-3 pt-2 dark:border-slate-800">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-slate-500 dark:text-slate-400">PANEL ADMIN</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Gestión UNA Piura</p>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Cerrar menú"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-1 overflow-y-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={
                'flex items-center gap-3 rounded-xl px-3 py-3 text-left transition ' +
                (selected
                  ? 'bg-[#0b3b5c] text-white shadow-md shadow-slate-900/15 dark:bg-emerald-400 dark:text-slate-950'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white')
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{tab.label}</span>
                <span className={'block text-xs ' + (selected ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400 dark:text-slate-500')}>
                  {tab.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
        >
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-100 transition-colors duration-300 dark:bg-slate-950">
      <Header title="RIGO · Administración bibliográfica" />

      {/* Barra móvil: hamburguesa para abrir el menú lateral completo (reemplaza las
          pestañas en scroll horizontal, que en pantallas angostas cortaban los íconos). */}
      <div className="border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <Menu className="h-4 w-4" />
          Menú admin
        </button>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white p-3 shadow-xl dark:bg-slate-900">{navContent}</div>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-5 lg:flex-row lg:px-6">
        <aside className="hidden shrink-0 lg:block lg:w-72">{navContent}</aside>

        <main className="min-w-0 flex-1 pb-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {activeTab !== 'dashboard' ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Volver al inicio del panel
                </button>
              ) : null}
              <p className="text-xs font-bold tracking-[0.18em] text-emerald-700 dark:text-emerald-400">ADMINISTRACIÓN</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{active.label}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{active.description}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/kiosk')}
              className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-emerald-300"
            >
              <Map className="h-4 w-4" /> Ir al kiosco
            </button>
          </div>
          {activeTab === 'dashboard' ? <AdminDashboard onNavigate={setActiveTab} /> : null}
          {activeTab === 'inventory' ? <InventoryTable authToken={authToken} /> : null}
          {activeTab === 'telemetry' ? <TelemetryCard authToken={authToken} /> : null}
          {activeTab === 'croquis' ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Croquis editable</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Arrastra las secciones, asigna nombre y código, y guarda el layout persistente.</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCroquisSaveError(null);
                      saveLayout().catch(() => setCroquisSaveError('No se pudo guardar el croquis. Intenta de nuevo.'));
                    }}
                    disabled={!isDirty}
                    className="rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Guardar layout
                  </button>
                  {croquisSaveError ? <p className="text-xs font-medium text-red-500">{croquisSaveError}</p> : null}
                </div>
              </div>
              <CroquisEditor shelves={shelves} selectedId={selectedId} onSelect={setSelected} onUpdateShelf={updateShelf} onAddShelf={addShelf} onDeleteShelf={deleteShelf} isAdmin />
            </section>
          ) : null}
          {activeTab === 'ingestion' ? <PDFIngestionModal isOpen onClose={() => setActiveTab('dashboard')} authToken={authToken} /> : null}
          {activeTab === 'vector-inspector' ? <VectorInspectorModal isOpen onClose={() => setActiveTab('dashboard')} authToken={authToken} /> : null}
          {activeTab === 'credentials' ? <CredentialsPanel authToken={authToken} /> : null}
        </main>
      </div>
    </div>
  );
}

function ProtectedAdmin() {
  const token = useAuthToken();
  return token ? <AdminPage authToken={token} /> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return <Routes><Route path="/" element={<Navigate to="/kiosk" replace />} /><Route path="/kiosk" element={<KioskPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/admin" element={<ProtectedAdmin />} /><Route path="*" element={<Navigate to="/kiosk" replace />} /></Routes>;
}

export default function App() {
  return (
    <BrowserRouter>
      <CroquisProvider>
        <AppRoutes />
        <SpeedInsights />
      </CroquisProvider>
    </BrowserRouter>
  );
}
