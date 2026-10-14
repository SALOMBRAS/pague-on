-- Permite registrar uma entrada separada da cobrança restante da venda.
ALTER TABLE "Sale"
  ADD COLUMN "downPaymentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Uma venda de descrição livre não consome estoque e, por isso, pode não ter
-- produto cadastrado. As vendas existentes mantêm a relação atual.
ALTER TABLE "SaleItem"
  ALTER COLUMN "productId" DROP NOT NULL;

ALTER TABLE "SaleItem"
  DROP CONSTRAINT IF EXISTS "SaleItem_productId_fkey";

ALTER TABLE "SaleItem"
  ADD CONSTRAINT "SaleItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
