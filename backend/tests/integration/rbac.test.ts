import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.js";

// RBAC — source de vérité = tables Role/Permission/RolePermission alimentées
// par le seed. Le middleware exigerPermission lit exactement ces données au
// moment de la connexion : ce test garantit que la matrice attendue par les
// routes (audit.consulter sur /api/audit…) correspond au contenu réel en base.
// Prérequis : `npm run db:seed`.

const ATTENDU: Record<string, { inclure: string[]; exclure: string[] }> = {
  SUPER_ADMIN: {
    inclure: [
      "parc.consulter",
      "utilisateurs.consulter",
      "stock.ecrire",
      "affectations.ecrire",
      "audit.consulter"
    ],
    exclure: []
  },
  IT_MANAGER: {
    inclure: ["parc.consulter", "utilisateurs.consulter", "affectations.confidentiels", "audit.consulter"],
    exclure: []
  },
  IT_TECHNICIAN: {
    inclure: ["parc.consulter", "stock.ecrire", "affectations.ecrire"],
    exclure: ["audit.consulter", "utilisateurs.consulter"]
  },
  STOCK_MANAGER: {
    inclure: ["parc.consulter", "stock.ecrire", "societes.gerer"],
    exclure: ["audit.consulter", "utilisateurs.consulter"]
  },
  AUDITOR: {
    inclure: ["parc.consulter", "utilisateurs.consulter", "audit.consulter"],
    exclure: ["stock.ecrire", "affectations.ecrire", "affectations.confidentiels"]
  },
  EMPLOYEE: {
    inclure: ["parc.consulter"],
    exclure: [
      "audit.consulter",
      "stock.ecrire",
      "affectations.ecrire",
      "utilisateurs.consulter",
      "affectations.confidentiels"
    ]
  }
};

let permissionsParRole: Map<string, Set<string>>;

beforeAll(async () => {
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: { select: { code: true } } } } }
  });
  permissionsParRole = new Map(
    roles.map((r) => [
      r.code,
      new Set(r.permissions.map((rp) => rp.permission.code))
    ])
  );
});

describe("matrice RBAC en base", () => {
  for (const [codeRole, attendu] of Object.entries(ATTENDU)) {
    describe(`rôle ${codeRole}`, () => {
      it("existe en base", () => {
        expect(permissionsParRole.has(codeRole)).toBe(true);
      });

      for (const code of attendu.inclure) {
        it(`possède « ${code} »`, () => {
          expect(permissionsParRole.get(codeRole)?.has(code)).toBe(true);
        });
      }

      for (const code of attendu.exclure) {
        it(`ne possède PAS « ${code} »`, () => {
          expect(permissionsParRole.get(codeRole)?.has(code)).toBe(false);
        });
      }
    });
  }
});
