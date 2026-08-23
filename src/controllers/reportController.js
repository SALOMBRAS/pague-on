const reportService = require('../services/reportService');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const HttpError = require('../utils/httpError');
const csvExporter = require('../services/csvExporter');
const pdfExporter = require('../services/pdfExporter');

async function cashflow(req, res) {
  return sendSuccess(res, serialize(await reportService.cashflowReport(req.user.id, req.query)));
}

async function profit(req, res) {
  return sendSuccess(res, serialize(await reportService.profitReport(req.user.id, req.query)));
}

async function debts(req, res) {
  return sendSuccess(res, serialize(await reportService.debtsReport(req.user.id, req.query)));
}

function asCsv(data) {
  const rows = Array.isArray(data) ? data : [data];
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header] instanceof Date ? row[header].toISOString() : row[header])).join(','))].join('\n');
}

async function exportData(req, res) {
  const { format = 'csv', type = 'debts' } = req.query;
  const date = new Date().toISOString().slice(0, 10);
  if (format === 'pdf') {
    const pdf = await pdfExporter.generateReport(req.user.id, req.query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="pagueon-relatorio-${date}.pdf"`);
    return res.status(200).send(pdf);
  }
  if (format === 'csv' && ['debts', 'products'].includes(type)) {
    const range = reportService.parseRange(req.query);
    const content = type === 'debts' ? await csvExporter.exportDebts(req.user.id, range) : await csvExporter.exportProducts(req.user.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pagueon-${type}-${date}.csv"`);
    return res.status(200).send(content);
  }
  const handlers = { cashflow: reportService.cashflowReport, profit: reportService.profitReport, debts: reportService.debtsReport };
  if (!handlers[type] || !['json', 'csv'].includes(format)) throw new HttpError(400, 'INVALID_EXPORT', 'Formato ou tipo de exportação inválido.');
  const data = serialize(await handlers[type](req.user.id, req.query));
  if (format === 'json') return sendSuccess(res, data);
  const rows = Array.isArray(data.entries) ? data.entries : Array.isArray(data.debts) ? data.debts : data.byProduct || [];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pagueon-${type}.csv"`);
  return res.status(200).send(asCsv(rows));
}

module.exports = { cashflow, profit, debts, exportData };
