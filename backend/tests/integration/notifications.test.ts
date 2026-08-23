import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import {
  listerNotifications,
  marquerCommeLue,
  marquerToutCommeLues
} from "../../src/services/notifications.service.js";
import { notifier } from "../../src/lib/notifications.js";

// Chantier 3.5 (P1.5) — fan-out par destinataire : la lecture par A ne marque
// plus « lue » pour B ; la déduplication reste garantie par destinataire.
// Fixtures : comptes de démonstration (prérequis : npm run db:seed).

const MARQUE = `vt-notif-${Date.now()}`;
let idA = "";
let idB = "";

beforeAll(async () => {
  const [a, b] = await Promise.all([
    prisma.utilisateur.findUnique({ where: { username: "zakaria.radouane" } }),
    prisma.utilisateur.findUnique({ where: { username: "karim.berrada" } })
  ]);
  if (!a || !b) throw new Error("Comptes de démonstration absents — exécutez npm run db:seed");
  idA = a.id;
  idB = b.id;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { entiteId: MARQUE } });
});

async function copiesPour(id: string) {
  const { items } = await listerNotifications(id);
  return items.filter((n: { entiteId?: string | null }) => n.entiteId === MARQUE);
}

describe("notifications par destinataire", () => {
  it("le fan-out crée une copie distincte par destinataire", async () => {
    await notifier({
      type: "INTERVENTION_ADMIN",
      titre: `[vitest] ${MARQUE}`,
      message: "Test d'isolation des notifications.",
      entite: "TEST_VITEST",
      entiteId: MARQUE,
      destinataireIds: [idA, idB]
    });

    expect(await copiesPour(idA)).toHaveLength(1);
    expect(await copiesPour(idB)).toHaveLength(1);
  });

  it("la déduplication ignore un second envoi identique OUVERT", async () => {
    await notifier({
      type: "INTERVENTION_ADMIN",
      titre: `[vitest] ${MARQUE}`,
      message: "Doublon volontaire.",
      entite: "TEST_VITEST",
      entiteId: MARQUE,
      destinataireIds: [idA, idB]
    });

    expect(await copiesPour(idA)).toHaveLength(1);
    expect(await copiesPour(idB)).toHaveLength(1);
  });

  it("marquerCommeLue refuse le destinataire qui ne possède pas la copie (403)", async () => {
    const [copieB] = await copiesPour(idB);
    try {
      await marquerCommeLue(copieB!.id, idA);
      throw new Error("devait lever");
    } catch (e) {
      expect((e as { status?: number }).status).toBe(403);
    }
  });

  it("lire la copie de A ne touche pas celle de B (isolation)", async () => {
    const [copieA] = await copiesPour(idA);
    await marquerCommeLue(copieA!.id, idA);

    const apresA = await copiesPour(idA);
    expect((apresA[0] as { statut: string }).statut).not.toBe("OUVERTE");

    const coteB = await copiesPour(idB);
    expect((coteB[0] as { statut: string }).statut).toBe("OUVERTE");
  });

  it("marquerToutCommeLues ne porte que sur SES notifications", async () => {
    await marquerToutCommeLues(idB);
    const coteB = await copiesPour(idB);
    expect((coteB[0] as { statut: string }).statut).not.toBe("OUVERTE");
  });
});
