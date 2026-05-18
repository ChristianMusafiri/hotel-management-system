-- CreateTable
CREATE TABLE "Hotel" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logo" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lubumbashi',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "localCurrency" TEXT NOT NULL DEFAULT 'FC',
    "currencyExchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 2300,
    "taxeRate" DOUBLE PRECISION NOT NULL DEFAULT 16,
    "checkInHour" INTEGER NOT NULL DEFAULT 14,
    "checkOutHour" INTEGER NOT NULL DEFAULT 10,
    "dayUseMaxHours" INTEGER NOT NULL DEFAULT 6,
    "subscriptionEnd" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPosEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isStockEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isHousekeepingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);
