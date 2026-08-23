import { defineConfig } from "vitest/config";

// Priorité 1 du chantier « corrections restantes » : suite de tests automatisée.
//  - `dotenv/config` charge backend/.env (DATABASE_URL, CLE_CHIFFREMENT…)
//    avant chaque fichier de test ;
//  - `fileParallelism: false` : les tests d'intégration partagent la même base
//    PostgreSQL locale ; ils s'exécutent séquentiellement pour éviter tout
//    croisement de fixtures (chaque fichier crée ses entités marquées et les
//    nettoie après lui) ;
//  - prérequis documenté : `npm run db:migrate && npm run db:seed` exécutés au
//    moins une fois (les rôles/comptes de démonstration servent de fixtures
//    RBAC et de destinataires de notifications).
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["dotenv/config"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false
  }
});
