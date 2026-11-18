// 실행: node test.js
const assert = require('assert');
const a = require('./app.js');
const ex = a.analyze(a.EXAMPLE);
assert(ex.ok && ex.total === 697);
assert.strictEqual(a.fmt(ex.shares[0]), '56.2');
assert.strictEqual(a.fmt(ex.shares[1]), '26.7');
assert.strictEqual(a.fmt(ex.shares[2]), '14.3');
assert.strictEqual(a.fmt(ex.shares[3]), '2.6');
assert.strictEqual(a.fmt(ex.shares[4]), '0.1');
assert.strictEqual(a.fmt(ex.diffPP), '36.2');
assert.strictEqual(ex.balanced, false);
assert.strictEqual(a.analyze([20, 20, 20, 20, 20]).balanced, true);
assert.strictEqual(a.analyze([30, 20, 20, 20, 10]).balanced, true);   // 경계 ±10%p
assert.strictEqual(a.analyze([31, 20, 19, 20, 10]).balanced, false);
for (const bad of ['', ' ', '-1', '1.5', 'abc', '1e3', '١٢', '9'.repeat(30)])
  assert.strictEqual(a.parseCount(bad).ok, false, 'count ' + bad);
assert.strictEqual(a.parseCount(' 12 ').value, 12);
assert.strictEqual(a.analyze([0, 0, 0, 0, 0]).ok, false);
assert.strictEqual(a.analyze(['1', '', 'x', '-2', '3.5']).errors.length, 4);
assert.strictEqual(a.analyze([0, 0, 0, 0, 5]).balanced, false);
assert.strictEqual(a.checkAccuracy('98.19').pass, true);
assert.strictEqual(a.checkAccuracy('90').pass, true);
assert.strictEqual(a.checkAccuracy('89.99').pass, false);
for (const bad of ['', '-1', '100.5', '101', 'abc', '9 8'])
  assert.strictEqual(a.checkAccuracy(bad).ok, false, 'acc ' + bad);
assert.strictEqual(a.checkAccuracy('0').ok, true);
assert.strictEqual(a.checkAccuracy('100').ok, true);
console.log('모든 테스트 통과');
