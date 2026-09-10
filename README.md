# RIGO-UNA v1

Asistente Bibliográfico Inteligente de la Universidad Nacional de Arte "Ignacio Merino" (UNA Piura).

`backend/` (con `backend/frontend/` dentro) es la **estructura única válida** del sistema (decisión D5): arquitectura dual
**Cloud Free (S/. 0.00) / On-Premise local con Ollama**, chat en streaming, visor de croquis 2D,
ficha móvil con código QR UTF-8 y visualizador de PDFs.

---

## Arranque sin Docker (desarrollo local)

### 1. Backend (FastAPI — puerto 8000)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
Copy-Item .env.example .env       # configurar GROQ_API_KEY si se usará modo cloud
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend (Vite — puerto 4952)

```powershell
cd backend/frontend
pnpm install
npm run dev
```

Abrir `http://localhost:4952`.

> Para el modo local completo (sin Groq), basta con Ollama corriendo en
> `127.0.0.1:11434` (`OLLAMA_BASE_URL`); el backend usa los modelos
> `qwen2.5:1.5b` (chat) y `nomic-embed-text` (embeddings 768-dim).
> Para el modo cloud es obligatorio tener Ollama disponible localmente como
> **fallback** (regla 2.2 de `AGENTS.md`).

---

## Modos de operación (`MODO_DEMO_CLOUD`)

Configurable en `backend/.env`:

| Valor  | Comportamiento |
|--------|----------------|
| `true`  | Conecta a **Groq** (`qwen/qwen3.6-27b`). Si Groq no responde (rate limit/caída), el backend intenta `qwen2.5:1.5b` vía Ollama antes de devolver error al kiosco. Uso de vectores: ChromaDB local (Opción B) o Pinecone según `VECTOR_BACKEND`. |
| `false` | Modo **on-premise**: todo corre local (Ollama `qwen2.5:1.5b` + `nomic-embed-text`, ChromaDB embebido, caché en RAM, PDFs en `storage/pdf/`). |

Las APIs y endpoints de FastAPI son **100% idénticos** en ambos modos.

---

## Catálogo semilla (seed automático)

Al arrancar, el backend crea la base SQLite (`storage/rigo.db`) y siembra el catálogo
institucional (`seed_database` en `backend/app/models.py`):

| Código | Título | Autor | Categoría | Ubicación |
|--------|--------|-------|-----------|-----------|
| `750.01`  | Tratado de la Pintura y del Paisaje | Leonardo Da Vinci | Talleres y Plástica | Pasillo 1 — Estante 2 (`P1-E2`) |
| `BIOG.01` | Forma y Color. Giotto los Frescos de Asís | Sadea Ed. | Biografías | Pasillo 2 — Estante A (`P2-EA`) |

Los códigos de catálogo usan siempre el **formato institucional real** (`750.01`, `BIOG.01`, …),
nunca `TESIS-01` (ver D8 de `propuesta_mvp_rigo.md`).

---

## Despliegue en la nube

Ver **`Despliegue_RIGO_Oracle_Cloud.md`**: Oracle Cloud Always Free (Ampere A1, 2 OCPU / 12 GB,
Docker con Ollama embebido, Opción B con ChromaDB) + Frontend en Vercel (Hobby).

---

## Estado del proyecto y QA

- Progreso por niveles: **`CHECKLIST_NIVEL_RIGO.md`** (Niveles 0–5).
- Verificación QA de los 7 tests obligatorios:

```powershell
cd scripts
.\qa_check.ps1 -BaseUrl http://127.0.0.1:8000
# Test 6 (paridad on-premise): reiniciar backend con MODO_DEMO_CLOUD=false y luego:
.\qa_check.ps1 -BaseUrl http://127.0.0.1:8000 -ExpectLocalMode
```
