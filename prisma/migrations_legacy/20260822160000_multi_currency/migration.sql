ALTER TABLE "Debt" ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL';
ALTER TABLE "Debt" ADD COLUMN "originalAmount" DECIMAL(12,2);
ALTER TABLE "Debt" ADD COLUMN "exchangeRate" DECIMAL(16,8) NOT NULL DEFAULT 1;

CREATE TABLE "Currency" (
  "code" VARCHAR(3) NOT NULL,
  "name" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "rateToBRL" DECIMAL(16,8) NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Currency_pkey" PRIMARY KEY ("code")
);

INSERT INTO "Currency" ("code", "name", "symbol", "rateToBRL", "updatedAt") VALUES
  ('BRL', 'Real brasileiro', 'R$', 1, CURRENT_TIMESTAMP),
  ('USD', 'Dólar americano', 'US$', 5.40, CURRENT_TIMESTAMP),
  ('EUR', 'Euro', '€', 5.85, CURRENT_TIMESTAMP),
  ('GBP', 'Libra esterlina', '£', 6.90, CURRENT_TIMESTAMP),
  ('ARS', 'Peso argentino', 'ARS$', 0.005, CURRENT_TIMESTAMP),
  ('CAD', 'Dólar canadense', 'CA$', 3.95, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
