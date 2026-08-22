# Gestion de Parc Informatique — IT Stock Manager

Application interne de gestion de parc informatique : équipements, affectations aux employés, stock, maintenance, licences.

Application full-stack séparée en deux dossiers (architecture : voir `docs/01-architecture.md`, plan de travail : `docs/02-plan-convergence.md`).

## Structure

```
STOCK-MANAGEMENT/
├── backend/    API Express + Prisma ORM + PostgreSQL 16
├── frontend/   React 19 + Vite + Tailwind CSS 4
└── docs/       Documents de conception
```

## Prérequis

- Node.js ≥ 20
- PostgreSQL 16 en local (base `stock_management`, utilisateur `stock_app`)

## Démarrage rapide

```powershell
# 1. Dépendances
npm run install:all

# 2. Base de données (migration + données de démonstration)
cd backend ; npx prisma migrate dev ; npm run db:seed ; cd ..

# 3. Tout lancer (backend :3001 + frontend :3000)
npm run dev
```

Ouvrir http://localhost:3000 — le frontend proxifie `/api` vers le backend.

## Scripts utiles

| Commande | Effet |
|---|---|
| `npm run dev` | Backend (tsx watch) + frontend (Vite) simultanément |
| `npm run db:migrate` | Migration Prisma en développement |
| `npm run db:seed` | Rejouer les données de démonstration |
| `npm run build` | Compile le backend (`dist/`) et le frontend (`frontend/dist/`) |
| `npm start` | Production : backend sert l'API + les fichiers compilés sur son port |

## Configuration

- `backend/.env` — `DATABASE_URL` et `PORT` (voir `backend/.env.example`). Aucun secret réel ne doit être commité.
