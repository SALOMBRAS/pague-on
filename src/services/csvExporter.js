const { Parser } = require('json2csv');
const prisma = require('../config/database');

const text = (value) => {
  const normalized = String(value ?? '');
  return /^[=+\-@]/.test(normalized) ? `\t${normalized}` : normalized;
};
const money = (value) => value === null || value === undefined ? '' : Number(value).toFixed(2);
const date = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';

function toCsv(rows, fields) {
  const parser = new Parser({ fields, delimiter: ';', withBOM: true, defaultValue: '' });
  return parser.parse(rows);
}

async function exportDebts(userId, range = {}) {
  const debts = await prisma.debt.findMany({
    where: { userId, ...(range.startDate || range.endDate ? { dueDate: { ...(range.startDate ? { gte: range.startDate } : {}), ...(range.endDate ? { lte: range.endDate } : {}) } } : {}) },
    orderBy: { dueDate: 'asc' },
  });
  return toCsv(debts, [
    { label: 'Tipo', value: (row) => row.type === 'RECEIVABLE' ? 'RECEBER' : 'PAGAR' },
    { label: 'Descrição', value: (row) => text(row.description) },
    { label: 'Pessoa/Empresa', value: (row) => text(row.counterparty) },
    { label: 'Valor Total', value: (row) => money(row.totalAmount) },
    { label: 'Valor Parcela', value: (row) => money(row.installmentAmount) },
    { label: 'Parcelas', value: (row) => row.totalInstallments ? `${row.paidInstallments}/${row.totalInstallments}` : '' },
    { label: 'Data Vencimento', value: (row) => date(row.dueDate) },
    { label: 'Status', value: 'status' },
    { label: 'Categoria', value: 'category' },
    { label: 'Tipo Pagamento', value: 'paymentType' },
    { label: 'Criado em', value: (row) => row.createdAt.toISOString() },
  ]);
}

async function exportProducts(userId) {
  const products = await prisma.product.findMany({ where: { userId, isActive: true }, include: { purchases: true }, orderBy: { name: 'asc' } });
  return toCsv(products, [
    { label: 'Nome', value: (row) => text(row.name) },
    { label: 'Categoria', value: (row) => text(row.category) },
    { label: 'Custo', value: (row) => money(row.costPrice) },
    { label: 'Preço Venda', value: (row) => money(row.sellingPrice) },
    { label: 'Margem %', value: (row) => money(row.profitMargin) },
    { label: 'Estoque', value: 'stockQuantity' },
    { label: 'Total Compras', value: (row) => row.purchases.length },
  ]);
}

module.exports = { exportDebts, exportProducts };
