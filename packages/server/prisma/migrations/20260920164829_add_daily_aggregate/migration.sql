-- CreateTable
CREATE TABLE "DailyAggregate" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "debitMinor" BIGINT NOT NULL,
    "creditMinor" BIGINT NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyAggregate_serviceId_accountId_currency_day_key" ON "DailyAggregate"("serviceId", "accountId", "currency", "day");

-- AddForeignKey
ALTER TABLE "DailyAggregate" ADD CONSTRAINT "DailyAggregate_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAggregate" ADD CONSTRAINT "DailyAggregate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
