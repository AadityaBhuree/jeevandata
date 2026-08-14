-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "patients_isDeleted_idx" ON "patients"("isDeleted");
