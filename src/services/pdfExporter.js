const puppeteer = require('puppeteer');
const prisma = require('../config/database');
const { parseRange } = require('./reportService');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const formatMoney = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const formatDate = (value) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value));

function reportHtml({ debts, products, startDate, endDate, totals }) {
  const maximum = Math.max(totals.receivable, totals.payable, 1);
  const rows = debts.map((debt) => `<tr><td>${debt.type === 'RECEIVABLE' ? 'A receber' : 'A pagar'}</td><td>${escapeHtml(debt.description)}</td><td>${escapeHtml(debt.counterparty)}</td><td>${formatMoney(debt.totalAmount)}</td><td>${formatDate(debt.dueDate)}</td><td class="${debt.status.toLowerCase()}">${debt.status}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nenhuma conta no período.</td></tr>';
  const stock = products.map((product) => `<tr><td>${escapeHtml(product.name)}</td><td>${escapeHtml(product.category || 'Sem categoria')}</td><td>${formatMoney(product.costPrice)}</td><td>${formatMoney(product.sellingPrice)}</td><td>${Number(product.profitMargin).toFixed(1)}%</td><td>${product.stockQuantity}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nenhum produto cadastrado.</td></tr>';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#f4f4f5;background:#0b0e13;padding:26px;font-size:11px}.header{border-bottom:2px solid #00e676;padding-bottom:18px;margin-bottom:22px}.brand{color:#00e676;font-size:27px;font-weight:800}.period{color:#a1a1aa;margin-top:6px}.summary{display:flex;gap:12px;margin:18px 0 24px}.card{flex:1;background:#161b22;border:1px solid #2a303a;border-radius:10px;padding:14px}.card small{color:#a1a1aa;text-transform:uppercase}.card strong{display:block;font-size:19px;margin-top:8px}.green{color:#00e676}.red{color:#ff6464}.chart{background:#161b22;border:1px solid #2a303a;border-radius:10px;padding:15px;margin-bottom:24px}.bar-row{display:flex;align-items:center;gap:10px;margin:9px 0}.bar-label{width:78px;color:#d4d4d8}.bar{height:10px;border-radius:5px;background:#00e676}.bar.redbar{background:#ff6464}table{width:100%;border-collapse:collapse;margin-top:10px}h2{font-size:15px;margin:24px 0 9px}th{background:#1d232c;color:#b5bac4;text-align:left;font-size:9px;text-transform:uppercase;padding:9px}td{padding:9px;border-bottom:1px solid #2a303a}.paid{color:#00e676}.overdue{color:#ff6464}.pending,.partial{color:#ffb74d}.empty{text-align:center;color:#a1a1aa;padding:22px}@page{size:A4;margin:16mm}</style></head><body><div class="header"><div class="brand">Pague-On</div><div class="period">Relatório financeiro · ${formatDate(startDate)} a ${formatDate(endDate)}</div></div><section class="summary"><div class="card"><small>Saldo projetado</small><strong>${formatMoney(totals.receivable - totals.payable)}</strong></div><div class="card"><small>A receber</small><strong class="green">${formatMoney(totals.receivable)}</strong></div><div class="card"><small>A pagar</small><strong class="red">${formatMoney(totals.payable)}</strong></div></section><section class="chart"><b>Visão do período</b><div class="bar-row"><span class="bar-label">A receber</span><span class="bar" style="width:${Math.round(totals.receivable / maximum * 70)}%"></span></div><div class="bar-row"><span class="bar-label">A pagar</span><span class="bar redbar" style="width:${Math.round(totals.payable / maximum * 70)}%"></span></div></section><h2>Contas e dívidas</h2><table><thead><tr><th>Tipo</th><th>Descrição</th><th>Pessoa/Empresa</th><th>Valor</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><h2>Produtos em estoque</h2><table><thead><tr><th>Nome</th><th>Categoria</th><th>Custo</th><th>Venda</th><th>Margem</th><th>Estoque</th></tr></thead><tbody>${stock}</tbody></table></body></html>`;
}

async function generateReport(userId, query) {
  const { startDate, endDate } = parseRange(query);
  const [debts, products] = await Promise.all([
    prisma.debt.findMany({ where: { userId, dueDate: { gte: startDate, lte: endDate } }, orderBy: { dueDate: 'asc' } }),
    prisma.product.findMany({ where: { userId, isActive: true }, orderBy: { name: 'asc' } }),
  ]);
  const totals = debts.reduce((result, debt) => { result[debt.type === 'RECEIVABLE' ? 'receivable' : 'payable'] += Number(debt.totalAmount); return result; }, { receivable: 0, payable: 0 });
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(reportHtml({ debts, products, startDate, endDate, totals }), { waitUntil: 'networkidle0' });
    return await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', right: '10mm', bottom: '14mm', left: '10mm' }, displayHeaderFooter: true, headerTemplate: '<div></div>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#777">Pague-On · Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>' });
  } finally { await browser.close(); }
}

module.exports = { generateReport, reportHtml };
