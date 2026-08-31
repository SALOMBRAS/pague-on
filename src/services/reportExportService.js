const ExcelJS = require('exceljs');

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const safeCellText = (value) => {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `\t${text}` : text;
};

function fileStamp(value = new Date()) {
  const iso = new Date(value).toISOString();
  return `${iso.slice(0, 10).replaceAll('-', '')}_${iso.slice(11, 19).replaceAll(':', '')}`;
}

function reportFilename(report, extension, value = new Date()) {
  return `relatorio_${report.report.key}_${fileStamp(value)}.${extension}`;
}

function filterDescription(filters = {}) {
  const items = [
    ['Período', filters.periodLabel],
    ['Cliente', filters.customerId],
    ['Cobrador', filters.collectorId],
    ['Caixa', filters.accountId],
    ['Modalidade', filters.modality],
    ['Situação', filters.status],
    ['Categoria', filters.category],
    ['Pagamento', filters.paymentMethod],
  ].filter(([, value]) => value);
  return items.map(([label, value]) => `${label}: ${value}`).join(' · ') || 'Sem filtros adicionais';
}

function valueForCell(row, column) {
  const value = row[column.key];
  if (value === null || value === undefined) return '';
  if (column.type === 'date') return new Date(value);
  if (column.type === 'currency' || column.type === 'number' || column.type === 'percentage') return Number(value);
  return safeCellText(value);
}

async function xlsx(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pague-On';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Relatório', { views: [{ state: 'frozen', ySplit: 7 }] });
  sheet.mergeCells('A1:H1'); sheet.getCell('A1').value = `Pague-On · ${report.report.title}`;
  sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF063E24' } };
  sheet.mergeCells('A2:H2'); sheet.getCell('A2').value = report.report.description;
  sheet.mergeCells('A3:H3'); sheet.getCell('A3').value = `Emitido em ${dateTime.format(new Date(report.generatedAt))}`;
  sheet.mergeCells('A4:H4'); sheet.getCell('A4').value = `Filtros: ${filterDescription(report.filters)}`;
  report.kpis.forEach((kpi, index) => {
    const cell = sheet.getCell(6, index + 1);
    cell.value = `${kpi.label}: ${kpi.type === 'currency' ? money.format(kpi.value) : kpi.type === 'percentage' ? `${Number(kpi.value).toFixed(2)}%` : kpi.value}`;
    cell.font = { bold: true, color: { argb: 'FF075E31' } };
  });
  const headerRow = 8;
  report.columns.forEach((column, index) => {
    const cell = sheet.getCell(headerRow, index + 1); cell.value = column.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF075E31' } };
  });
  for (const row of report.rows) {
    const line = sheet.addRow(report.columns.map((column) => valueForCell(row, column)));
    report.columns.forEach((column, index) => {
      const cell = line.getCell(index + 1);
      if (column.type === 'currency') cell.numFmt = '[$R$-pt-BR] #,##0.00';
      if (column.type === 'percentage') cell.numFmt = '0.00%';
      if (column.type === 'date') cell.numFmt = 'dd/mm/yyyy';
    });
  }
  const totalsStart = Math.max(headerRow + report.rows.length + 2, 10);
  sheet.getCell(totalsStart, 1).value = 'Totais conciliáveis'; sheet.getCell(totalsStart, 1).font = { bold: true };
  Object.entries(report.totals).forEach(([key, value], index) => { sheet.getCell(totalsStart + index + 1, 1).value = key; sheet.getCell(totalsStart + index + 1, 2).value = typeof value === 'number' ? value : safeCellText(value); });
  sheet.columns.forEach((column) => { column.width = 19; });
  return workbook.xlsx.writeBuffer();
}

module.exports = { xlsx, reportFilename, filterDescription };
