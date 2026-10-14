const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const customerService = fs.readFileSync('src/services/customerService.js', 'utf8');
const quickOperation = fs.readFileSync('public/quick-operation.js', 'utf8');
const people = fs.readFileSync('public/people.js', 'utf8');

test('cliente criado pela equipe já fica visível e aprovado', () => {
  assert.match(customerService, /status: 'APPROVED'/);
  assert.match(customerService, /approvedAt: new Date\(\)/);
  assert.match(customerService, /approvedById: userId/);
});

test('venda rápida atualiza imediatamente a lista de clientes', () => {
  assert.match(quickOperation, /pagueon:customer-created/);
  assert.match(people, /includeCreatedCustomer/);
  assert.match(people, /window\.addEventListener\('pagueon:customer-created'/);
});

test('cadastro de pessoa normaliza campos opcionais vazios antes de enviar à API', () => {
  assert.match(people, /function customerPayload\(person\)/);
  assert.match(people, /key !== 'name' && !value\.trim\(\) \? null : value/);
  assert.match(people, /api\(\)\.post\('\/people', customerPayload\(person\)\)/);
});
