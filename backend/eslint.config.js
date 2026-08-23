// Priorité 5 du chantier « corrections restantes » — ESLint progressif.
// Configuration FLAT (ESLint 9) volontairement minimale :
//  - règles recommandées typescript-eslint (correctness, pas de style
//    cosmétique imposé — prettier reste l'outil de formatage si décidé plus
//    tard) ;
//  - `no-explicit-any` en AVERTISSEMENT : la règle AGENTS.md est « pas de any
//    sans justification écrite », le code existant documente ses rares usages
//    ; passer en erreur se fera au fil des refactorings, pas en bloc ici.
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.ts"]
  })),
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.ts"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ]
    }
  }
);
