# Restructure Report — Backend/Frontend Split + PostgreSQL

**Date:** August 22, 2026
**Scope:** Full restructuring of the STOCK-MANAGEMENT monolith into a layered full-stack application per `docs/01architecture.md`.

---

## 1. Objective

Transform the original single-file Express monolith (`server.ts`, ~1 900 lines, in-memory JavaScript arrays) into:

| Layer     | Technology                                  | Port |
|-----------|---------------------------------------------|------|
| Backend   | Express + Prisma ORM + PostgreSQL 16 + Gemini | 3001 |
| Frontend  | React 19 + Vite + Tailwind CSS 4            | 3000 |

The existing React frontend required **zero code changes** — all API contracts were preserved exactly.

---

## 2. What Was Done

### Phase 1 — Environment setup
- [x] Downloaded original repo as ZIP, extracted to project root
- [x] Installed Node.js v24.19.0 via winget
- [x] Installed dependencies, ran the original app on port 3000
- [x] Added Gemini API key to `.env`, verified AI endpoints live

### Phase 2 — Database
- [x] Installed PostgreSQL 16 via winget (service `postgresql-x64-16`)
- [x] Created role `stock_app` and database `stock_management` (credentials in `backend/.env`, never committed)
- [x] Granted `CREATEDB` to allow Prisma's shadow database

### Phase 3 — Prisma schema & migration
- [x] Wrote `backend/prisma/schema.prisma` — **12 models**, French names mapped to snake_case tables via `@@map`/`@map`:
  - `Fournisseur` → `fournisseurs`
  - `BonCommande` → `bons_commande` (+ `LigneCommande`)
  - `Budget` → `budgets`
  - `AppelOffres` → `appels_offres` (+ `Offre`)
  - `Utilisateur` → `utilisateurs`
  - `ArticleStock` → `articles_stock`
  - `MouvementStock` → `mouvements_stock`
  - `Affectation` → `affectations` (+ `LigneAffectation`, `RetourAffectation`)
- [x] Design decisions:
  - Business IDs preserved as string PKs (`DA-2026-001`, `STK-001`, `v-1`, `usr-1`, `AFF-2026-001`, `MVT-001`)
  - `seq Int @unique @default(autoincrement())` on every main table to reproduce the old `unshift()` display order (newest first); budgets use ascending order
  - Money stored as `Float`, not `Decimal` (Prisma Decimal serializes to JSON strings, which would break frontend arithmetic)
  - Display dates kept as `String` columns for output parity
  - Stock movements reference items by plain string ID (no FK) so history survives item deletion
- [x] Ran `prisma migrate dev --name init` — migration `20260821174425_init` applied

### Phase 4 — Backend services layer (routes → services → Prisma)
- [x] `lib/prisma.ts` — singleton client
- [x] `lib/gemini.ts` — lazy Gemini client (`gemini-3.5-flash`), automatic heuristic fallback when no key
- [x] `lib/erreurs.ts` — `ErreurMetier` (400/404/409) + helpers
- [x] `lib/ids.ts` — date/id helpers
- [x] **8 service modules** with all business logic ported verbatim:
  - `dashboard.service.ts` — global data aggregate (parallel queries)
  - `fournisseurs.service.ts` — vendor creation, rating updates
  - `bons-commande.service.ts` — PO creation ($transaction: PO + budget upsert + vendor spend), status transitions adjusting budget/vendor both directions
  - `appels-offres.service.ts` — RFQ comparative simulations
  - `utilisateurs.service.ts` — permission matrix defaults, duplicate email guard, last-admin protection
  - `stock.service.ts` — search/filter, all movement types (Sortie/Retour/Entrée Achat/Rebut/Ajustement), PO import with category deduction & warranty dates
  - `affectations.service.ts` — availability pre-validation, $transaction assignments with stock updates + movement logs, SIM-direct pseudo-items, restitution with action branches
  - `ia.service.ts` — Gemini bid analysis + contract drafting with rule-based fallbacks
- [x] Thin route handlers mapping exactly to the original API:
  - Reads return `{status:"ok", data}`; mutations return `{message, data}`; errors `{error}` with proper HTTP codes
  - ~25 endpoints under `/api`: `/data`, `/pos`, `/pos/:id/status`, `/vendors`, `/vendors/:id/rating`, `/rfq`, `/users` (CRUD + status), `/stock` (CRUD + search/movement/import-po), `/assignments` (CRUD + return), `/ai/analyze-bids`, `/ai/draft-terms`
- [x] `app.ts` — central error handler, production static serving of `../frontend/dist`
- [x] `server.ts` — DB connectivity check at startup, listens on `PORT || 3001`

### Phase 5 — Frontend extraction
- [x] Moved `src/`, `index.html`, `tsconfig.json` into `frontend/`
- [x] New `frontend/package.json` — removed server-only deps (`express`, `dotenv`, `@google/genai`, `firebase`)
- [x] Deleted unused `src/lib/firebase.ts`
- [x] New `vite.config.ts` keeping the `@` alias + adding dev proxy: `/api` → `http://localhost:3001`

### Phase 6 — Orchestration & cleanup
- [x] Root `package.json` with `concurrently`:
  - `npm run dev` → backend (tsx watch) + frontend (Vite) together
  - `npm run build` / `npm start` → production build, backend serves the SPA
  - `npm run db:migrate` / `db:seed` / `install:all`
- [x] Seeded database with the full demo dataset (reverse-insertion trick reproduces original ordering)
- [x] Archived legacy files to `_legacy/`: old `server.ts`, old configs, Firebase files, root lockfiles, `node_modules`
- [x] Copied architecture doc to `docs/01architecture.md`; rewrote root `README.md`; updated `.gitignore`

---

## 3. Verification Results

| Check | Result |
|---|---|
| `tsc --noEmit` backend | ✅ 0 errors |
| `tsc --noEmit` frontend | ✅ 0 errors |
| Backend boots on :3001 | ✅ PostgreSQL connected |
| Vite on :3000 | ✅ HTML served (root div present) |
| `GET /api/data` through proxy | ✅ 4 budgets, 5 vendors, 5 POs, 2 RFQs, 5 users, 7 stock items, 4 movements, 3 assignments |
| Mutation persistence | ✅ Vendor created → visible immediately at top of list (unshift parity) → deleted from DB |
| `GET /api/stock/search?q=laptop` | ✅ 2 results |
| `POST /api/ai/draft-terms` | ✅ Gemini live response (13 623 chars) |

---

## 4. How to Run

```powershell
# One-time setup
npm run install:all
cd backend ; npx prisma migrate dev ; npm run db:seed ; cd ..

# Every day
npm run dev          # → http://localhost:3000
```

Configuration lives in `backend/.env` (see `backend/.env.example`): `DATABASE_URL`, `PORT`, `GEMINI_API_KEY`. Without a Gemini key the AI features fall back to the local heuristic engine.

---

## 5. Current File Tree

```
STOCK-MANAGEMENT/
├── package.json          # orchestrator (concurrently)
├── README.md             # quick-start guide
├── .gitignore
├── docs/
│   ├── 01-architecture.md # target architecture (source doc)
│   └── RESTRUCTURE-REPORT.md  # this file
├── backend/
│   ├── prisma/           # schema.prisma, migrations/, seed.ts
│   └── src/
│       ├── routes/       # thin HTTP layer + error handler
│       ├── services/     # 8 business modules
│       └── lib/          # prisma, gemini, erreurs, ids
├── frontend/
│   ├── index.html
│   ├── vite.config.ts    # @ alias + /api proxy
│   └── src/              # untouched React app
└── _legacy/              # archived original monolith files
```

---

## 6. Remaining Ideas (optional, not started)

- Authentication layer (JWT) — currently open API like the original
- Docker Compose (Postgres + backend + frontend)
- CI pipeline running both typechecks + migrations against a temp database
