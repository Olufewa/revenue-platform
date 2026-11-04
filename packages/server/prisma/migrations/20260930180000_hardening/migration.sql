-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "requestHash" TEXT;

-- AlterTable
ALTER TABLE "LedgerTransaction" ADD COLUMN     "rateSource" TEXT,
ADD COLUMN     "requestHash" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "LedgerTransaction_serviceId_occurredAt_idx" ON "LedgerTransaction"("serviceId", "occurredAt");

-- CreateIndex
CREATE INDEX "Entry_serviceId_accountId_occurredAt_idx" ON "Entry"("serviceId", "accountId", "occurredAt");
