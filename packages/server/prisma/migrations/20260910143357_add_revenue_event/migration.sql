-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PENDING', 'POSTED', 'FAILED');

-- CreateTable
CREATE TABLE "RevenueEvent" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "status" "EventStatus" NOT NULL DEFAULT 'PENDING',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RevenueEvent_serviceId_occurredAt_idx" ON "RevenueEvent"("serviceId", "occurredAt");

-- CreateIndex
CREATE INDEX "RevenueEvent_serviceId_status_idx" ON "RevenueEvent"("serviceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueEvent_serviceId_externalId_key" ON "RevenueEvent"("serviceId", "externalId");

-- AddForeignKey
ALTER TABLE "RevenueEvent" ADD CONSTRAINT "RevenueEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
