const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const goals = fs.readFileSync('public/goals.js', 'utf8');
const styles = fs.readFileSync('public/goals-status.css', 'utf8');
test('goals prioritize status, forecast and a separate completed section', () => { assert.match(goals, /No ritmo/); assert.match(goals, /Atenção/); assert.match(goals, /Em risco/); assert.match(goals, /Previsão:/); assert.match(goals, /Faltam \$\{money\(remaining\)\}/); assert.match(goals, /goals-completed/); assert.match(goals, /risk: 0, attention: 1, pace: 2/); });
test('goal details are responsive drawer or mobile sheet', () => { assert.match(goals, /goal-detail-sheet/); assert.match(goals, /ritmo médio dos depósitos/); assert.match(styles, /justify-content:flex-end/); assert.match(styles, /@media\(max-width:760px\)/); assert.match(styles, /align-items:flex-end/); });
