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
// CSV 집계
const NL = String.fromCharCode(10), CR = String.fromCharCode(13);
assert.strictEqual(a.parseCsv(a.buildCsv(a.EXAMPLE)).rows, 697);
assert.strictEqual(a.fmt(a.analyze(a.parseCsv(a.buildCsv(a.EXAMPLE)).counts).shares[0]), '56.2');
const u = a.parseCsv(['predicted','BelkinCamera','Foo','','"AmazonEcho"',' belkincamera '].join(CR + NL));
assert(u.ok && u.unknown === 1 && u.counts[0] === 2 && u.counts[1] === 1 && u.rows === 4);
assert.strictEqual(a.parseCsv('').ok, false);
assert.strictEqual(a.parseCsv(NL + NL).ok, false);
assert.strictEqual(a.parseCsv('BelkinCamera' + NL + 'AmazonEcho').ok, false);   // 헤더 없음
assert.strictEqual(a.parseCsv('predicted').ok, false);                          // 데이터 없음
assert.strictEqual(a.parseCsv('x'.repeat(5000001)).ok, false);                  // 5MB 초과
assert.strictEqual(a.parseCsv(null).ok, false);
const allUnknown = a.parseCsv('predicted' + NL + 'Foo' + NL + 'Bar');
assert(allUnknown.ok && allUnknown.unknown === 2 && a.analyze(allUnknown.counts).ok === false);
assert.deepStrictEqual(a.parseCsv('id,predicted' + NL + '1,TPLinkSmartPlug').counts, [0,0,0,0,1]);
// 별칭(코드 라벨) 매핑
const al = a.parseCsv(['predicted','TPLinkPlug','NetatmoWeather','SmartThings','tplinkplug','TPLinkSmartPlug','Foo'].join(NL));
assert(al.ok && al.unknown === 1);
assert.deepStrictEqual(al.counts, [0, 0, 1, 1, 3]);
// 샘플 2개
assert.deepStrictEqual(Object.keys(a.SAMPLES), ['known', 'paper_pc']);
const pp = a.parseCsv(a.SAMPLES.paper_pc.build());
assert(pp.ok && !pp.hasActual && pp.unknown === 0 && pp.rows === 697);
assert.deepStrictEqual(pp.counts, a.EXAMPLE);
const kn = a.parseCsv(a.SAMPLES.known.build());
assert(kn.ok && kn.hasActual && kn.rows === 100 && kn.correct === 98 && kn.unknown === 0 && kn.actualUnknown === 0);
assert.strictEqual(kn.accuracy, 98);
assert.strictEqual(kn.counts.reduce((x, y) => x + y, 0), 100);
assert.strictEqual(a.checkAccuracy(String(kn.accuracy)).pass, true);
// actual 열: 순서 바뀜·별칭·5종 밖
const sw = a.parseCsv(['predicted,actual', 'TPLinkPlug,TPLinkSmartPlug', 'AmazonEcho,BelkinCamera', 'Foo,AmazonEcho', 'AmazonEcho,Bar'].join(NL));
assert(sw.ok && sw.hasActual && sw.rows === 4 && sw.correct === 1 && sw.unknown === 1 && sw.actualUnknown === 1 && sw.accuracy === 25);
const onlyPred = a.parseCsv('predicted' + NL + 'AmazonEcho');
assert(onlyPred.ok && onlyPred.hasActual === false && onlyPred.accuracy === undefined);
assert.strictEqual(a.parseCsv('actual' + NL + 'AmazonEcho').ok, false);       // predicted 없음
assert.strictEqual(a.parseCsv('actual,predicted').ok, false);                  // 데이터 행 없음
assert.strictEqual(a.parseCsv('AmazonEcho,AmazonEcho' + NL + 'AmazonEcho,AmazonEcho').ok, false); // 헤더 없음
assert.strictEqual(a.KNOWN_TABLE.length, 5);
assert.strictEqual(a.KNOWN_TABLE.reduce((s, r) => s + r[4], 0), 12816);
console.log('모든 테스트 통과');
