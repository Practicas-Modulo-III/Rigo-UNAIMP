import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Circle, Library, Loader2, Sparkles, Trash2, Eye, Download } from 'lucide-react';
import { apiFetch, resolveBackendUrl } from '@/services/api';
import { useCategories } from '@/hooks/useCategories';

/** Fases simuladas del pipeline de ingesta (OCR + vectorización) mostradas mientras se "analiza" el archivo. */
const ANALYSIS_PHASES = [
  { label: 'PDF Splitter', detail: 'Extrayendo páginas del documento' },
  { label: 'Tesseract OCR', detail: 'Reconocimiento de texto' },
  { label: 'Text Chunking', detail: '800 caracteres / fragmento' },
  { label: 'Embedding', detail: 'nomic-embed-text' },
] as const;

/** Humaniza el nombre de archivo para sugerir un título editable por el admin. */
function guessTitleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base.replace(/\b\w/g, (char) => char.toUpperCase());
}

export interface IngestionLogEntry {
  id: number;
  filename: string;
  rights_status: string;
  status: string;
  detail: string;
  file_path: string | null;
  created_at: string | null;
}

interface PDFIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
}

const RIGHTS_STATUS_OPTIONS = [
  { value: 'institutional', label: 'Institucional (UNA)' },
  { value: 'public_domain', label: 'Dominio Público' },
  { value: 'needs_authorization', label: 'Requiere Autorización (D.L. 822)' },
] as const;


export function PDFIngestionModal({ isOpen, onClose, authToken }: PDFIngestionModalProps) {
  const { names: categoryNames, refresh: refreshCategories } = useCategories();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [formData, setFormData] = useState({
    book_id: '',
    title: '',
    author: '',
    category: 'Talleres y Plástica',
    year: new Date().getFullYear(),
    pasillo: 1,
    estante: 'A',
    tag_code: '',
    rights_status: 'institutional' as 'institutional' | 'public_domain' | 'needs_authorization',
  });
  /** 'digital' exige PDF (OCR + contenido indexado); 'physical' registra solo la ficha de un
      ejemplar que existe en la sala pero no está digitalizado. */
  const [recordType, setRecordType] = useState<'digital' | 'physical'>('digital');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string; logId?: number } | null>(null);
  const [logs, setLogs] = useState<IngestionLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  // El servidor manda su propio MAX_UPLOAD_MB junto con los logs; 50 es solo el valor de arranque
  // hasta que responde, para no duplicar el límite en dos lugares que se desincronicen.
  const [maxUploadMb, setMaxUploadMb] = useState(50);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<IngestionLogEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [completedPhases, setCompletedPhases] = useState(0);
  const [pageCount] = useState(() => 4 + Math.floor(Math.random() * 60));

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, authToken]);

  // Simula el pipeline de OCR/vectorización (PDF Splitter → OCR → Chunking → Embedding)
  // y, al terminar, sugiere un título editable a partir del nombre de archivo.
  useEffect(() => {
    if (!file) {
      setAnalyzing(false);
      setCompletedPhases(0);
      return undefined;
    }
    setAnalyzing(true);
    setCompletedPhases(0);
    const timeouts = ANALYSIS_PHASES.map((_, index) =>
      window.setTimeout(() => setCompletedPhases(index + 1), (index + 1) * 550),
    );
    const finalTimeout = window.setTimeout(() => {
      setAnalyzing(false);
      setFormData((current) => (current.title ? current : { ...current, title: guessTitleFromFilename(file.name) }));
    }, ANALYSIS_PHASES.length * 550 + 300);
    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(finalTimeout);
    };
  }, [file]);

  const fetchLogs = useCallback(async () => {
    if (!authToken) return;
    setLoadingLogs(true);
    try {
      const res = await apiFetch('/api/documents/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (typeof data.max_upload_mb === 'number') setMaxUploadMb(data.max_upload_mb);
      }
    } catch {
      // ignore
    } finally {
      setLoadingLogs(false);
    }
  }, [authToken]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  /** Valida extensión y peso antes de subir nada.
   *
   * Antes un archivo inválido se descartaba en silencio (no pasaba nada al soltarlo, sin
   * explicación) y uno demasiado grande viajaba entero por la red solo para que el servidor
   * lo rechazara al final. El servidor sigue validando: esto es solo la primera barrera. */
  const acceptFile = useCallback((candidate: File): void => {
    if (!candidate.name.toLowerCase().endsWith('.pdf')) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileError(`Solo se aceptan archivos PDF. «${candidate.name}» no lo es.`);
      return;
    }
    const sizeMb = candidate.size / 1024 / 1024;
    if (sizeMb > maxUploadMb) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileError(
        `El archivo pesa ${sizeMb.toFixed(1)} MB y el límite es ${maxUploadMb} MB. ` +
          'Usa una versión comprimida o pide al administrador que amplíe el límite.',
      );
      return;
    }
    setFileError(null);
    setFile(candidate);
  }, [maxUploadMb]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) acceptFile(e.dataTransfer.files[0]);
  }, [acceptFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) acceptFile(e.target.files[0]);
  }, [acceptFile]);

  const handleCreateCategory = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreatingCategory(true);
    try {
      const res = await apiFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setFormData((current) => ({ ...current, category: name }));
        setAddingCategory(false);
        setNewCategoryName('');
        refreshCategories();
      } else {
        setSubmitResult({ success: false, message: data?.detail || 'No se pudo crear la categoría' });
      }
    } catch {
      setSubmitResult({ success: false, message: 'Error de conexión con el servidor' });
    } finally {
      setCreatingCategory(false);
    }
  }, [newCategoryName, refreshCategories]);

  const removeFile = useCallback(() => {
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) {
      setSubmitResult({ success: false, message: 'Token de autenticación requerido' });
      return;
    }

    if (recordType === 'digital' && !file) {
      setSubmitResult({ success: false, message: 'Adjunta el PDF o cambia el registro a "Solo ejemplar físico"' });
      return;
    }

    setSubmitting(true);
    setSubmitResult(null);

    const formDataToSend = new FormData();
    formDataToSend.append('book_id', formData.book_id);
    formDataToSend.append('title', formData.title);
    formDataToSend.append('author', formData.author);
    formDataToSend.append('category', formData.category);
    formDataToSend.append('year', formData.year.toString());
    formDataToSend.append('pasillo', formData.pasillo.toString());
    formDataToSend.append('estante', formData.estante);
    formDataToSend.append('tag_code', formData.tag_code);
    formDataToSend.append('quantity', '1');
    formDataToSend.append('rights_status', formData.rights_status);
    if (recordType === 'digital' && file) {
      formDataToSend.append('file', file);
    }

    try {
      const res = await apiFetch('/api/documents/upload', {
        method: 'POST',
        body: formDataToSend,
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitResult({
          success: true,
          message: recordType === 'physical'
            ? 'Ejemplar físico registrado: RIGO ya puede indicar su ubicación'
            : 'Documento encolado para procesamiento',
          logId: data.log_id,
        });
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchLogs();
      } else {
        setSubmitResult({ success: false, message: data.detail || 'Error al subir documento' });
      }
    } catch {
      setSubmitResult({ success: false, message: 'Error de conexión con el servidor' });
    } finally {
      setSubmitting(false);
    }
  }, [formData, file, authToken, fetchLogs, recordType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 dark:bg-slate-950 dark:border-slate-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Ingesta de Documentos PDF
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">Tipo de registro *</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                { id: 'digital' as const, title: 'Documento digitalizado', detail: 'Sube el PDF: se hace OCR y su contenido queda indexado.' },
                { id: 'physical' as const, title: 'Solo ejemplar físico', detail: 'Sin PDF: RIGO lo sugiere e indica dónde está en la sala.' },
              ]).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setRecordType(option.id)}
                  className={
                    'rounded-xl border p-3 text-left transition-colors ' +
                    (recordType === option.id
                      ? 'border-emerald-500 bg-emerald-500/5'
                      : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500')
                  }
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {option.id === 'digital' ? <FileText className="h-4 w-4 shrink-0" /> : <Library className="h-4 w-4 shrink-0" />}
                    {option.title}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{option.detail}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="book_id" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Código de Catálogo (book_id) *
              </label>
              <input
                type="text"
                id="book_id"
                value={formData.book_id}
                onChange={(e) => setFormData({ ...formData, book_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                placeholder="Ej: 750.01, BIOG. 01"
                required
              />
            </div>
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Título *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                required
              />
            </div>
            <div>
              <label htmlFor="author" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Autor *
              </label>
              <input
                type="text"
                id="author"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                required
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Categoría *
              </label>
              {addingCategory ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nombre de la categoría"
                    maxLength={100}
                    className="flex-1 rounded-lg border border-emerald-400 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={!newCategoryName.trim() || creatingCategory}
                    className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
                  >
                    {creatingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingCategory(false); setNewCategoryName(''); }}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setAddingCategory(true);
                      return;
                    }
                    setFormData({ ...formData, category: e.target.value });
                  }}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                >
                  {categoryNames.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__new__">+ Agregar categoría nueva…</option>
                </select>
              )}
            </div>
            <div>
              <label htmlFor="year" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Año *
              </label>
              <input
                type="number"
                id="year"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                min={1900}
                max={new Date().getFullYear() + 1}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                required
              />
            </div>
            <div>
              <label htmlFor="pasillo" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Pasillo *
              </label>
              <select
                id="pasillo"
                value={formData.pasillo}
                onChange={(e) => setFormData({ ...formData, pasillo: parseInt(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
              >
                <option value={1}>Pasillo 1</option>
                <option value={2}>Pasillo 2</option>
                <option value={3}>Pasillo 3</option>
                <option value={0}>Archivo / Fuera de pasillos</option>
              </select>
            </div>
            <div>
              <label htmlFor="estante" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Estante *
              </label>
              <input
                type="text"
                id="estante"
                value={formData.estante}
                onChange={(e) => setFormData({ ...formData, estante: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                placeholder="Ej: A, B, C, Archivo de Tesis"
                required
              />
            </div>
            <div>
              <label htmlFor="tag_code" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Código de Etiqueta (tag_code) *
              </label>
              <input
                type="text"
                id="tag_code"
                value={formData.tag_code}
                onChange={(e) => setFormData({ ...formData, tag_code: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                placeholder="Ej: P1-EA, P2-EB, P3-EC"
                required
              />
            </div>
            <div>
              <label htmlFor="rights_status" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Estado de Derechos (D.L. 822) *
              </label>
              <select
                id="rights_status"
                value={formData.rights_status}
                onChange={(e) => setFormData({ ...formData, rights_status: e.target.value as typeof formData.rights_status })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
              >
                {RIGHTS_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formData.rights_status === 'needs_authorization'
                  ? '⚠️ Requiere autorización: no se indexa el contenido, solo la ficha'
                  : recordType === 'physical'
                  ? 'Ejemplar físico: se indexa la ficha para poder ubicarlo, sin contenido'
                  : 'Se requiere archivo adjunto para procesamiento completo'}
              </p>
            </div>
          </div>

          {recordType === 'digital' ? (
          <div className="relative">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                dragActive
                  ? 'border-emerald-400 bg-emerald-400/5'
                  : file
                  ? 'border-emerald-400/50 bg-emerald-400/5'
                  : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                accept="application/pdf,.pdf"
                onChange={handleFileSelect}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={submitting}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                {file ? (
                  <div className="flex items-center justify-center gap-3 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-8 w-8" />
                    <div className="text-left">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="rounded-lg p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                      aria-label="Eliminar archivo"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" />
                    <p className="mt-3 text-slate-600 dark:text-slate-300">
                      Arrastra y suelta un archivo PDF aquí, o haz clic para seleccionar
                    </p>
                    <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">Solo PDF · Máx. {maxUploadMb} MB</p>
                  </>
                )}
              </label>
            </div>

            {fileError ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <p className="text-sm text-red-600 dark:text-red-300">{fileError}</p>
              </div>
            ) : null}
          </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <Library className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-white">Registro sin digitalizar.</strong> Se guardará la ficha
                (título, autor, categoría y ubicación) para que RIGO pueda sugerir este ejemplar cuando pregunten por temas
                relacionados e indicar en qué pasillo y estante encontrarlo. No se indexa contenido, así que RIGO nunca citará
                páginas de este libro.
              </p>
            </div>
          )}

          {recordType === 'digital' && file && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                  )}
                  {analyzing
                    ? `RIGO está analizando el documento: ${file.name}`
                    : `Análisis completado: ${file.name}`}
                </p>
                <span className="shrink-0 text-xs font-mono text-slate-500 dark:text-slate-400">
                  {Math.round((completedPhases / ANALYSIS_PHASES.length) * 100)}%
                </span>
              </div>

              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
                  style={{ width: `${(completedPhases / ANALYSIS_PHASES.length) * 100}%` }}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-4">
                {ANALYSIS_PHASES.map((phase, index) => {
                  const done = index < completedPhases;
                  const active = index === completedPhases && analyzing;
                  return (
                    <div
                      key={phase.label}
                      className={`rounded-lg border p-2.5 text-xs transition-colors ${
                        done
                          ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                          : active
                          ? 'border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                          : 'border-slate-200 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-1.5 font-semibold">
                        {done ? (
                          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                        ) : active ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 shrink-0" />
                        )}
                        {index + 1}. {phase.label}
                      </div>
                      <p className="truncate">{done ? phase.detail : active ? 'Procesando…' : 'En espera'}</p>
                    </div>
                  );
                })}
              </div>

              {analyzing ? (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Procesados: {Math.round((completedPhases / ANALYSIS_PHASES.length) * pageCount)} / {pageCount} páginas
                </p>
              ) : (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  Título sugerido a partir del archivo — revisa y edita los campos antes de encolar.
                </p>
              )}
            </div>
          )}

          {formData.rights_status === 'needs_authorization' && !file && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <strong>Gate D.L. 822 activo:</strong> Al seleccionar "Requiere Autorización" sin adjuntar archivo,
                solo se registrarán los metadatos del documento (código, título, autor, ubicación). No se realizará
                OCR ni indexación de contenido hasta que se autorice y se suba el archivo.
              </div>
            </div>
          )}

          {submitResult && (
            <div
              className={`rounded-lg p-4 flex items-center gap-3 ${
                submitResult.success
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-red-500/30 bg-red-500/5'
              }`}
            >
              {submitResult.success ? (
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              )}
              <div className="text-sm">
                <p className="font-medium">{submitResult.success ? 'Éxito' : 'Error'}</p>
                <p className="text-slate-500 dark:text-slate-400">{submitResult.message}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              disabled={submitting || analyzing}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Procesando...
                </>
              ) : analyzing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analizando documento…
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  {recordType === 'physical'
                    ? 'Registrar ejemplar físico'
                    : file
                    ? 'Guardar e Indexar en ChromaDB'
                    : 'Encolar para Ingesta'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </form>

        <div className="border-t border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Historial de Ingesta
            </h3>
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <Loader2 className={`h-4 w-4 ${loadingLogs ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Archivo</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Derechos</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Detalle</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Fecha</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                      No hay registros de ingesta
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200 font-mono">{log.filename}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            log.rights_status === 'needs_authorization'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : log.rights_status === 'public_domain'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {RIGHTS_STATUS_OPTIONS.find((o) => o.value === log.rights_status)?.label || log.rights_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            log.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : log.status === 'processing'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : log.status === 'metadata_only'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : log.status === 'flagged_review'
                              ? 'bg-orange-500/15 font-bold text-orange-600 ring-1 ring-inset ring-orange-500/40 dark:text-orange-400'
                              : log.status === 'failed'
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                              : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {log.status === 'flagged_review' ? '⚠ revisar' : log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={log.detail}>
                        {log.detail}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono">
                        {log.created_at ? new Date(log.created_at).toLocaleString('es-PE') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {log.file_path && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const filePath = log.file_path!.split('/').pop();
                                if (filePath) {
                                  window.open(resolveBackendUrl(`/storage/pdf/${filePath}`), '_blank');
                                }
                              }}
                              className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                              aria-label="Ver PDF"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedLog(null)}>
            <div className="w-full max-w-2xl bg-white border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Detalle de Ingesta</h4>
                <button onClick={() => setSelectedLog(null)} className="rounded-lg p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-slate-500 dark:text-slate-400">ID:</span>
                  <span className="text-slate-900 dark:text-white font-mono">{selectedLog.id}</span>
                  <span className="text-slate-500 dark:text-slate-400">Archivo:</span>
                  <span className="text-slate-700 dark:text-slate-200">{selectedLog.filename}</span>
                  <span className="text-slate-500 dark:text-slate-400">Derechos:</span>
                  <span className="text-slate-900 dark:text-white">{RIGHTS_STATUS_OPTIONS.find((o) => o.value === selectedLog.rights_status)?.label}</span>
                  <span className="text-slate-500 dark:text-slate-400">Estado:</span>
                  <span className="text-slate-900 dark:text-white">{selectedLog.status}</span>
                  <span className="text-slate-500 dark:text-slate-400">Fecha:</span>
                  <span className="text-slate-900 dark:text-white">{selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString('es-PE') : '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Detalle:</span>
                  <p className="mt-1 text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{selectedLog.detail}</p>
                </div>
                {selectedLog.file_path && (
                  <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => window.open(resolveBackendUrl(`/storage/pdf/${selectedLog.file_path!.split('/').pop()}`), '_blank')}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 dark:bg-emerald-400/10 px-3 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 dark:hover:bg-emerald-400/20"
                    >
                      <Eye className="h-4 w-4" />
                      Ver PDF
                    </button>
                    <button
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = resolveBackendUrl(`/storage/pdf/${selectedLog.file_path!.split('/').pop()}`);
                        a.download = selectedLog.filename;
                        a.click();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Download className="h-4 w-4" />
                      Descargar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
