# Gestion des Achats & Approvisionnements

Application full-stack sÃ©parÃ©e en deux dossiers (architecture : voir `docs/01-architecture.md`).

## Structure

```
STOCK-MANAGEMENT/
â”œâ”€â”€ backend/    API Express + Prisma ORM + PostgreSQL 16 (+ Gemini IA)
â”œâ”€â”€ frontend/   React 19 + Vite + Tailwind CSS 4
â””â”€â”€ docs/       Documents de conception
```

## PrÃ©requis

- Node.js â‰¥ 20
- PostgreSQL 16 en local (base `stock_management`, utilisateur `stock_app`)

## DÃ©marrage rapide

```powershell
# 1. DÃ©pendances
npm run install:all

# 2. Base de donnÃ©es (migration + donnÃ©es de dÃ©monstration)
cd backend ; npx prisma migrate dev ; npm run db:seed ; cd ..

# 3. Tout lancer (backend :3001 + frontend :3000)
npm run dev
```

Ouvrir http://localhost:3000 â€” le frontend proxifie `/api` vers le backend.

## Scripts utiles

| Commande | Effet |
|---|---|
| `npm run dev` | Backend (tsx watch) + frontend (Vite) simultanÃ©ment |
| `npm run db:migrate` | Migration Prisma en dÃ©veloppement |
| `npm run db:seed` | Rejouer les donnÃ©es de dÃ©monstration |
| `npm run build` | Compile le backend (`dist/`) et le frontend (`frontend/dist/`) |
| `npm start` | Production : backend sert l'API + les fichiers compilÃ©s sur son port |

## Configuration

- `backend/.env` â€” `DATABASE_URL`, `PORT`, `GEMINI_API_KEY` (voir `backend/.env.example`)
- Sans clÃ© Gemini, les fonctionnalitÃ©s IA basculent automatiquement sur le moteur heuristique local.

