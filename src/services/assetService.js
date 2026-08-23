const prisma = require('../config/database');
const HttpError = require('../utils/httpError');

const assetGroup = { CASH: 'CASH', INVESTMENT_STOCK: 'INVESTMENT', INVESTMENT_CRYPTO: 'INVESTMENT', INVESTMENT_FIXED: 'INVESTMENT', PROPERTY: 'PROPERTY', VEHICLE: 'PROPERTY', OTHER: 'OTHER' };
const startOfToday = () => { const date = new Date(); return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); };
const number = (value) => Number(value || 0);

async function findOwnedAsset(userId, id) { const asset = await prisma.asset.findFirst({ where: { id, userId } }); if (!asset) throw new HttpError(404, 'ASSET_NOT_FOUND', 'Ativo não encontrado.'); return asset; }
async function listAssets(userId) { return prisma.asset.findMany({ where: { userId }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }); }
async function createAsset(userId, input) { return prisma.asset.create({ data: { userId, ...input } }); }
async function updateAsset(userId, id, input) { await findOwnedAsset(userId, id); return prisma.asset.update({ where: { id }, data: input }); }
async function removeAsset(userId, id) { await findOwnedAsset(userId, id); return prisma.asset.delete({ where: { id } }); }

function groupedAssets(assets, products, cash) {
  const groups = { CASH: { total: cash, items: cash ? [{ id: 'cash-flow', name: 'Caixa registrado', type: 'CASH', value: cash, isLiquid: true }] : [] }, PRODUCTS: { total: 0, items: [] }, INVESTMENT: { total: 0, items: [] }, PROPERTY: { total: 0, items: [] }, OTHER: { total: 0, items: [] } };
  for (const asset of assets) { const group = assetGroup[asset.type] || 'OTHER'; const value = number(asset.value); groups[group].total += value; groups[group].items.push({ ...asset, value }); }
  for (const product of products) { const value = number(product.costPrice) * product.stockQuantity; groups.PRODUCTS.total += value; groups.PRODUCTS.items.push({ id: `product-${product.id}`, name: product.name, type: 'PRODUCTS', value, stockQuantity: product.stockQuantity, isLiquid: false }); }
  return groups;
}
function groupedLiabilities(debts) {
  const groups = { DEBTS: { total: 0, items: [] }, LOANS: { total: 0, items: [] } };
  for (const debt of debts) { const value = Math.max(0, number(debt.totalAmount) - number(debt.paidAmount)); const group = debt.category === 'LOAN' ? 'LOANS' : 'DEBTS'; groups[group].total += value; groups[group].items.push({ id: debt.id, name: debt.description, counterparty: debt.counterparty, dueDate: debt.dueDate, value, category: debt.category }); }
  return groups;
}

async function netWorth(userId) {
  const [assets, products, debts, latestCash] = await Promise.all([
    listAssets(userId),
    prisma.product.findMany({ where: { userId, isActive: true }, select: { id: true, name: true, costPrice: true, stockQuantity: true } }),
    prisma.debt.findMany({ where: { userId, type: 'PAYABLE', status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] }, isActive: true }, select: { id: true, description: true, counterparty: true, category: true, dueDate: true, totalAmount: true, paidAmount: true } }),
    prisma.cashFlow.findFirst({ where: { userId }, orderBy: { date: 'desc' }, select: { balance: true } }),
  ]);
  const assetGroups = groupedAssets(assets, products, number(latestCash?.balance)); const liabilityGroups = groupedLiabilities(debts); const totalAssets = Object.values(assetGroups).reduce((sum, group) => sum + group.total, 0); const totalLiabilities = Object.values(liabilityGroups).reduce((sum, group) => sum + group.total, 0); const netWorth = totalAssets - totalLiabilities; const date = startOfToday();
  await prisma.netWorthSnapshot.upsert({ where: { userId_date: { userId, date } }, create: { userId, date, netWorth, totalAssets, liabilities: totalLiabilities }, update: { netWorth, totalAssets, liabilities: totalLiabilities } });
  const [previous, snapshots] = await Promise.all([
    prisma.netWorthSnapshot.findFirst({ where: { userId, date: { lt: date } }, orderBy: { date: 'desc' } }),
    prisma.netWorthSnapshot.findMany({ where: { userId, date: { gte: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 11, 1)) } }, orderBy: { date: 'asc' } }),
  ]);
  const change = previous ? netWorth - number(previous.netWorth) : 0;
  return { netWorth, netWorthChange: change, netWorthChangePercent: previous && number(previous.netWorth) ? (change / Math.abs(number(previous.netWorth))) * 100 : 0, totalAssets, totalLiabilities, assets: assetGroups, liabilities: liabilityGroups, evolution: snapshots.map((snapshot) => ({ date: snapshot.date, netWorth: number(snapshot.netWorth), totalAssets: number(snapshot.totalAssets), liabilities: number(snapshot.liabilities) })) };
}

module.exports = { findOwnedAsset, listAssets, createAsset, updateAsset, removeAsset, netWorth, groupedAssets, groupedLiabilities };
