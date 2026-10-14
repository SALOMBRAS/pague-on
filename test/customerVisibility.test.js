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

test('venda rápida mantém o contato na própria venda, sem criar cliente', () => {
  assert.match(quickOperation, /counterparty: values\.customerName/);
  assert.match(quickOperation, /counterpartyPhone: values\.customerPhone/);
  assert.doesNotMatch(quickOperation, /\/customers\?search=/);
  assert.doesNotMatch(quickOperation, /pagueon:customer-created|pagueOnApi\.post\('\/customers'/);
  assert.match(people, /includeCreatedCustomer/);
});

test('cadastro de pessoa normaliza campos opcionais vazios antes de enviar à API', () => {
  assert.match(people, /function customerPayload\(person\)/);
  assert.match(people, /key !== 'name' && !value\.trim\(\) \? null : value/);
  assert.match(people, /api\(\)\.post\('\/people', customerPayload\(person\)\)/);
});

test('histórico de clientes permite arquivamento somente após confirmação explícita', () => {
  assert.match(people, /function confirmDeletePerson\(personId\)/);
  assert.match(people, /aria-modal="true"/);
  assert.match(people, /data-delete-confirm/);
  assert.match(people, /api\(\)\.delete\(`\/people\/\$\{person\.id\}`\)/);
  assert.match(people, /As vendas e cobranças já registradas serão preservadas/);
});
