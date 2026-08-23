CREATE TYPE "AssetType" AS ENUM ('CASH', 'INVESTMENT_STOCK', 'INVESTMENT_CRYPTO', 'INVESTMENT_FIXED', 'PROPERTY', 'VEHICLE', 'OTHER');

CREATE TABLE "Asset" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AssetType" NOT NULL,
  "value" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "isLiquid" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Asset_userId_type_idx" ON "Asset"("userId", "type");

CREATE TABLE "NetWorthSnapshot" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "netWorth" DECIMAL(12,2) NOT NULL,
  "totalAssets" DECIMAL(12,2) NOT NULL,
  "liabilities" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NetWorthSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NetWorthSnapshot_userId_date_key" ON "NetWorthSnapshot"("userId", "date");
CREATE INDEX "NetWorthSnapshot_userId_date_idx" ON "NetWorthSnapshot"("userId", "date");
