CREATE TABLE "Budget" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "category" "DebtCategory" NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "limitAmount" DECIMAL(12,2) NOT NULL,
  "spentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "rollover" BOOLEAN NOT NULL DEFAULT false,
  "alertAt" INTEGER NOT NULL DEFAULT 80,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Budget_userId_category_month_year_key" ON "Budget"("userId", "category", "month", "year");
CREATE INDEX "Budget_userId_year_month_idx" ON "Budget"("userId", "year", "month");

ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
