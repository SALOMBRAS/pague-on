const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const middlewareSource = fs.readFileSync(path.resolve(__dirname, '../src/middlewares/uploadMiddleware.js'), 'utf8');
const appSource = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');

// Regressão P1: uploads gravados no filesystem local se perdem na Vercel (efêmero).
// Em produção o arquivo deve ir para o Supabase Storage e o front receber URL pública.

test('lê as credenciais do Supabase Storage do ambiente', () => {
  assert.match(middlewareSource, /process\.env\.SUPABASE_URL/);
  assert.match(middlewareSource, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
});

test('faz upload para o Supabase Storage via API REST', () => {
  assert.match(middlewareSource, /\/storage\/v1\/object\//);
  assert.match(middlewareSource, /Authorization:\s*`Bearer \$\{supabaseServiceRole\}`/);
  assert.match(middlewareSource, /x-upsert/);
});

test('retorna URL pública do bucket e mantém fallback local em dev', () => {
  assert.match(middlewareSource, /storage\/v1\/object\/public\//);
  assert.match(middlewareSource, /if \(file\.storageUrl\) return file\.storageUrl/);
  assert.match(middlewareSource, /\/uploads\//);
});

test('usa memoryStorage em produção e diskStorage em desenvolvimento', () => {
  assert.match(middlewareSource, /multer\.memoryStorage\(\)/);
  assert.match(middlewareSource, /multer\.diskStorage\(/);
  assert.match(middlewareSource, /storageConfigured\s*\?/);
});

test('servir /uploads estático apenas em desenvolvimento', () => {
  assert.match(appSource, /if \(!process\.env\.SUPABASE_URL\)/);
  assert.match(appSource, /express\.static\(path\.resolve\(process\.env\.UPLOAD_PATH/);
});
