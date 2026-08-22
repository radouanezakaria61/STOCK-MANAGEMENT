-- AlterTable
ALTER TABLE "articles_stock" ADD COLUMN     "quantite_maintenance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "requetes_idempotentes" ALTER COLUMN "status_reponse" SET DEFAULT 0,
ALTER COLUMN "corps_reponse" DROP NOT NULL;

