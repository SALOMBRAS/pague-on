const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');

test('interface de relatórios usa a API, filtros e exportações do backend', () => {
  const html = read('index.html');
  const app = read('app.js');
  const reports = read('reports.js');
  const worker = read('sw.js');
  assert.match(html, /id="reportsView"/);
  assert.match(html, /href="\/reports\.css"/);
  assert.match(html, /src="\/reports\.js"/);
  assert.match(app, /state\.screen==='reports'/);
  assert.match(reports, /\/reports\/catalog/);
  assert.match(reports, /data-report-export="xlsx"/);
  assert.match(reports, /data-report-export="pdf"/);
  assert.match(worker, /'\/reports\.css'/);
  assert.match(worker, /'\/reports\.js'/);
});
