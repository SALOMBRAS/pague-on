const prisma = require('../config/database');

function normalize(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
function similarity(left, right) {
  const a = normalize(left).replace(/\s/g, ''); const b = normalize(right).replace(/\s/g, '');
  if (!a && !b) return 1; if (!a || !b) return 0; if (a === b) return 1;
  const row = Array.from({ length: b.length + 1 }, (_item, index) => index);
  for (let i = 1; i <= a.length; i += 1) { let previous = row[0]; row[0] = i; for (let j = 1; j <= b.length; j += 1) { const old = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1)); previous = old; } }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}
function duplicateScore(existing, input) {
  let score = 0;
  if (normalize(existing.counterparty) && normalize(existing.counterparty) === normalize(input.counterparty)) score += 30;
  if (Math.abs(Number(existing.totalAmount) - Number(input.totalAmount)) < 0.01) score += 40;
  if (Math.abs(new Date(existing.dueDate) - new Date(input.startDate || input.dueDate)) < 86400000) score += 20;
  const descriptionSimilarity = similarity(existing.description, input.description);
  if (descriptionSimilarity > 0.8) score += 10;
  return { score, descriptionSimilarity };
}
async function findDuplicates(userId, input, sensitivity) {
  const user = sensitivity ? null : await prisma.user.findUnique({ where: { id: userId }, select: { duplicateSensitivity: true } }); const threshold = sensitivity || user?.duplicateSensitivity || 70;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const debts = await prisma.debt.findMany({ where: { userId, type: input.type, status: { not: 'CANCELLED' }, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 100 });
  return debts.map((debt) => ({ debt, ...duplicateScore(debt, input) })).filter((item) => item.score >= threshold).sort((left, right) => right.score - left.score);
}

module.exports = { normalize, similarity, duplicateScore, findDuplicates };
