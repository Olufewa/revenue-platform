-- AlterTable
ALTER TABLE "RevenueEvent" ADD COLUMN     "reversesEventId" TEXT;

-- CreateIndex
CREATE INDEX "RevenueEvent_reversesEventId_idx" ON "RevenueEvent"("reversesEventId");

-- AddForeignKey
ALTER TABLE "RevenueEvent" ADD CONSTRAINT "RevenueEvent_reversesEventId_fkey" FOREIGN KEY ("reversesEventId") REFERENCES "RevenueEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
