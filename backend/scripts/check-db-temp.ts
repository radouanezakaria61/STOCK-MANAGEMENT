import { PrismaClient } from "@prisma/client";

async function main() {
  const db = new PrismaClient();
  const col = await db.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name='notifications' AND column_name='destinataire_id'"
  );
  console.log("colonne:", JSON.stringify(col));
  const m = await db.$queryRawUnsafe(
    "SELECT migration_name, finished_at IS NOT NULL AS fini FROM _prisma_migrations ORDER BY started_at DESC LIMIT 3"
  );
  console.log(JSON.stringify(m, null, 1));
  await db.$disconnect();
}
main();
