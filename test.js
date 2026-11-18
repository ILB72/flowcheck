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
// 샘플 1개(논문 PC 사례)
assert.deepStrictEqual(Object.keys(a.SAMPLES), ['paper_pc']);
const pp = a.parseCsv(a.SAMPLES.paper_pc.build());
assert(pp.ok && pp.unknown === 0 && pp.rows === 697);
assert.strictEqual(a.parseCsv('actual,predicted' + NL + 'AmazonEcho,AmazonEcho').ok, true); // 다른 열은 무시, predicted만 사용
assert.deepStrictEqual(pp.counts, a.EXAMPLE);
assert.strictEqual(a.parseCsv('actual' + NL + 'AmazonEcho').ok, false);       // predicted 열 없음
assert.strictEqual(a.parseCsv('predicted').ok, false);                          // 데이터 행 없음
assert.strictEqual(a.parseCsv('AmazonEcho,AmazonEcho' + NL + 'AmazonEcho,AmazonEcho').ok, false); // 헤더 없음
assert.strictEqual(a.KNOWN_TABLE.length, 5);
assert.strictEqual(a.KNOWN_TABLE.reduce((s, r) => s + r[4], 0), 12816);
// 표 3 혼동행렬·열 합계
const cm = a.CONFUSION;
assert.strictEqual(cm.reduce((s, r) => s + r.reduce((x, y) => x + y, 0), 0), 12816);
assert.strictEqual(cm.reduce((s, r, i) => s + r[i], 0), 12584);
assert.deepStrictEqual(cm.map(r => r.reduce((x, y) => x + y, 0)), [2563, 2563, 2563, 2564, 2563]);
assert.strictEqual(cm[3][0], 126);
// 작업 1: 기기별 맞힌 수·비율(표 3 대각선/행합계)
const st = [0, 1, 2, 3, 4].map(i => a.deviceStats(i));
assert.deepStrictEqual(st.map(s => s.correct), [2545, 2554, 2562, 2415, 2508]);
assert.deepStrictEqual(st.map(s => s.total), [2563, 2563, 2563, 2564, 2563]);
assert.strictEqual(st.reduce((x, s) => x + s.correct, 0), 12584);
assert.deepStrictEqual(st.map(s => s.rate.toFixed(2)), ['99.30', '99.65', '99.96', '94.19', '97.85']);
assert.strictEqual(st[3].worstName, 'AmazonEcho');
assert.strictEqual(st[3].worstCount, 126);                       // 논문 §4.1: 126건이 AmazonEcho로
assert.deepStrictEqual([st[0].worstName, st[0].worstCount], ['SamsungSmartThings', 11]);
assert.strictEqual(a.lowestDevice(), 3);                          // SamsungSmartThings가 가장 낮음
// 작업 2: 단계 이동
assert.strictEqual(a.STEP_TOTAL, 4);
assert.strictEqual(a.stepMove(1, 1), 2);
assert.strictEqual(a.stepMove(4, 1), 1);                          // 마지막에서 '처음부터'
assert.strictEqual(a.stepMove(1, -1), 1);                         // 첫 단계에서 이전은 멈춤
assert.strictEqual(a.stepMove(3, -1), 2);
// 삭제한 재학습 값·실제 트래픽 예시가 코드에 남지 않았는지
const fs = require('fs');
const src = ['app.js', 'index.html', 'README.md', 'samples/README.md'].map(f => fs.readFileSync(f, 'utf-8')).join(String.fromCharCode(10));
assert(!/98[.]18|FLOWCHECK_EXAMPLE|example_data|sample_registered|make_example/.test(src));
assert.deepStrictEqual(fs.readdirSync('samples').sort(), ['README.md', 'sample_paper_pc.csv']);
// 테마 로직: 저장값 > 시스템, 잘못된 값 무시, 저장소 예외 처리
const mem = (v) => ({ v, getItem() { return this.v; }, setItem(k, x) { this.v = x; }, removeItem() { this.v = null; } });
assert.strictEqual(a.readTheme(mem('dark')), 'dark');
assert.strictEqual(a.readTheme(mem('light')), 'light');
assert.strictEqual(a.readTheme(mem('blue')), 'system');
assert.strictEqual(a.readTheme(mem(null)), 'system');
assert.strictEqual(a.readTheme(null), 'system');
assert.strictEqual(a.readTheme({ getItem() { throw new Error('blocked'); } }), 'system');
assert.deepStrictEqual(['system', 'light', 'dark', 'system'].map(a.nextTheme), ['light', 'dark', 'system', 'light']);
assert.strictEqual(a.nextTheme('???'), 'light');
const m2 = mem(null);
assert.strictEqual(a.saveTheme(m2, 'dark'), true); assert.strictEqual(m2.v, 'dark');
assert.strictEqual(a.saveTheme(m2, 'system'), true); assert.strictEqual(m2.v, null);
assert.strictEqual(a.saveTheme({ setItem() { throw new Error('quota'); }, removeItem() { throw new Error('quota'); } }, 'light'), false);
assert.strictEqual(a.saveTheme(null, 'light'), false);
console.log('모든 테스트 통과');
