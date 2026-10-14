const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const validators = fs.readFileSync(path.join(root, 'src', 'utils', 'validators.js'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'src', 'controllers', 'customerRegistrationController.js'), 'utf8');

test('cadastro público não altera anotações internas nem devolve o cadastro completo', () => {
  const schema = validators.match(/const customerSelfRegistrationSchema = ([\s\S]*?)\.strict\(\);/)?.[1] || '';
  assert.doesNotMatch(schema, /notes|creditLimit|approvedInterestRate|collectorId|classificationId/);
  assert.match(controller, /function publicSubmission\(customer\) \{\s*return \{ status: customer\.status \};/);
  assert.doesNotMatch(controller, /serialize\(await service\.submit/);
});
