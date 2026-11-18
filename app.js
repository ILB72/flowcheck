(function (root) {
  'use strict';

  var CLASSES = ['BelkinCamera', 'AmazonEcho', 'SamsungSmartThings', 'NetatmoWeatherStation', 'TPLinkSmartPlug'];
  var EXAMPLE = [392, 186, 100, 18, 1]; // 논문: 학습에 없던 PC 트래픽 697 Flow
  var BASE = 20;      // 논문 H2: 각 클래스 20% 내외
  var RANGE = 10;     // '내외'의 앱 내 해석: ±10%p
  var H1 = 90;        // 논문 H1: 정확도 90% 이상

  function parseCount(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (s === '') return { ok: false, error: '빈칸입니다. 0 이상의 정수를 입력하세요.' };
    if (/^-/.test(s)) return { ok: false, error: '음수는 입력할 수 없습니다. 0 이상의 정수를 입력하세요.' };
    if (/^\d+[.,]\d*$|^[.,]\d+$/.test(s)) return { ok: false, error: '소수는 입력할 수 없습니다. 건수는 정수로 입력하세요.' };
    if (!/^[0-9]+$/.test(s)) return { ok: false, error: '숫자만 입력할 수 있습니다.' };
    var n = Number(s);
    if (!Number.isSafeInteger(n) || n > 1e12) return { ok: false, error: '값이 너무 큽니다.' };
    return { ok: true, value: n };
  }

  function analyze(rawCounts) {
    var errors = [], counts = [];
    CLASSES.forEach(function (name, i) {
      var r = parseCount(rawCounts[i]);
      if (r.ok) counts.push(r.value); else { errors.push({ index: i, message: name + ': ' + r.error }); counts.push(0); }
    });
    if (errors.length) return { ok: false, errors: errors };
    var total = counts.reduce(function (a, b) { return a + b; }, 0);
    if (total === 0) return { ok: false, errors: [{ index: -1, message: '모든 건수가 0입니다. 하나 이상의 클래스에 1 이상을 입력하세요.' }] };
    var shares = counts.map(function (c) { return c / total * 100; });
    var maxShare = Math.max.apply(null, shares);
    var maxIndex = shares.indexOf(maxShare);
    var balanced = shares.every(function (s) { return Math.abs(s - BASE) <= RANGE + 1e-9; });
    return { ok: true, counts: counts, total: total, shares: shares, maxIndex: maxIndex, maxShare: maxShare, diffPP: maxShare - BASE, balanced: balanced };
  }

  function checkAccuracy(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (s === '') return { ok: false, error: '빈칸입니다. 0~100 사이의 숫자를 입력하세요.' };
    if (!/^-?[0-9]+(\.[0-9]+)?$/.test(s)) return { ok: false, error: '숫자만 입력할 수 있습니다. 예: 98.19' };
    var v = Number(s);
    if (v < 0 || v > 100) return { ok: false, error: '정확도는 0~100 사이여야 합니다.' };
    return { ok: true, value: v, pass: v >= H1 };
  }

  function fmt(x) { return (Math.round(x * 10) / 10).toFixed(1); }

  var MAX_CSV = 5 * 1000 * 1000; // 5MB 초과는 처리하지 않음
  var SAMPLES = {
    paper_pc: { file: 'sample_paper_pc.csv', build: function () { return buildCsv(EXAMPLE); } }
  };

  // 합성 예시 CSV 생성(고정 시드 셔플, 실제 트래픽 아님)
  function buildCsv(counts) {
    var labels = [];
    counts.forEach(function (c, i) { for (var k = 0; k < c; k++) labels.push(CLASSES[i]); });
    var seed = 12345;
    for (var j = labels.length - 1; j > 0; j--) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      var r = seed % (j + 1), t = labels[j]; labels[j] = labels[r]; labels[r] = t;
    }
    var NL = String.fromCharCode(10);
    return 'predicted' + NL + labels.join(NL) + NL;
  }

  // 코드 라벨(재현 스크립트 표기) → 논문 표기 클래스 index
  var ALIASES = { tplinkplug: 4, netatmoweather: 3, smartthings: 2 };

  // CSV(predicted 열) 집계. 알 수 없는 클래스는 무시하지 않고 개수를 센다.
  function parseCsv(text) {
    if (text == null || typeof text !== 'string') return { ok: false, error: '내용이 없습니다.' };
    if (text.length > MAX_CSV) return { ok: false, error: '파일이 너무 큽니다(5MB 이하만 가능).' };
    if (text.charCodeAt(0) === 65279) text = text.slice(1);   // BOM 제거
    var lines = text.split(String.fromCharCode(10)).map(function (l) { return l.trim(); }).filter(function (l) { return l !== ''; });
    if (!lines.length) return { ok: false, error: '빈 파일입니다. 첫 줄에 predicted, 그 아래 한 줄에 클래스명 하나씩 넣어 주세요.' };
    var clean = function (v) { return v.trim().replace(/^"|"$/g, '').trim(); };
    var header = lines[0].split(',').map(function (v) { return clean(v).toLowerCase(); });
    var col = header.indexOf('predicted');
    if (col < 0) return { ok: false, error: '헤더가 없습니다. 첫 줄에 predicted 열이 있어야 합니다.' };
    var counts = [0, 0, 0, 0, 0], unknown = 0;
    var names = CLASSES.map(function (c) { return c.toLowerCase(); });
    var rows = lines.length - 1;
    if (rows === 0) return { ok: false, error: '데이터 행이 없습니다. predicted 아래에 클래스명을 넣어 주세요.' };
    for (var i = 1; i < lines.length; i++) {
      var v = clean(lines[i].split(',')[col] || '').toLowerCase();
      var k = names.indexOf(v);
      if (k < 0 && ALIASES.hasOwnProperty(v)) k = ALIASES[v];
      if (k >= 0) counts[k]++; else unknown++;
    }
    return { ok: true, counts: counts, unknown: unknown, rows: rows };
  }

  // 논문 표 2(5종 기기 내부 테스트, §4.1): [Precision, Recall, F1, Support]. 이름은 화면 전체와 같은 전체 이름으로 통일.
  var PAPER_ORDER = ['AmazonEcho', 'BelkinCamera', 'NetatmoWeatherStation', 'SamsungSmartThings', 'TPLinkSmartPlug'];
  var KNOWN_TABLE = [
    ['AmazonEcho', 0.95, 0.99, 0.97, 2563],
    ['BelkinCamera', 1.00, 1.00, 1.00, 2563],
    ['NetatmoWeatherStation', 1.00, 1.00, 1.00, 2563],
    ['SamsungSmartThings', 0.98, 0.94, 0.96, 2564],
    ['TPLinkSmartPlug', 0.99, 0.98, 0.98, 2563]
  ];
  var KNOWN_MACRO = [0.98, 0.98, 0.98];
  // 논문 표 3 혼동행렬(행=실제, 열=예측, PAPER_ORDER 순서)
  var CONFUSION = [
    [2545, 4, 0, 11, 3],
    [2, 2554, 1, 6, 0],
    [0, 0, 2562, 0, 1],
    [126, 2, 3, 2415, 18],
    [8, 3, 1, 43, 2508]
  ];
  // 표 3(혼동행렬)에서 기기별 맞힌 수·비율·가장 많이 틀린 상대를 읽는다(논문 값만 사용)
  function deviceStats(i) {
    var row = CONFUSION[i];
    var total = row.reduce(function (a, b) { return a + b; }, 0);
    var correct = row[i];
    var worst = -1;
    row.forEach(function (v, j) { if (j !== i && (worst < 0 || v > row[worst])) worst = j; });
    return { name: PAPER_ORDER[i], total: total, correct: correct, wrong: total - correct, rate: correct / total * 100,
      worstName: PAPER_ORDER[worst], worstCount: row[worst] };
  }
  function lowestDevice() {
    var low = 0;
    PAPER_ORDER.forEach(function (n, i) { if (deviceStats(i).rate < deviceStats(low).rate) low = i; });
    return low;
  }
  // 단계 이동: 다음(+1)은 마지막 단계에서 처음으로, 이전(-1)은 첫 단계에서 멈춘다
  var STEP_TOTAL = 4;
  function stepMove(cur, dir) {
    if (dir > 0) return cur >= STEP_TOTAL ? 1 : cur + 1;
    return cur <= 1 ? 1 : cur - 1;
  }

  // ---- 화면 테마(시스템 → 라이트 → 다크 순환). 저장값이 있으면 시스템 설정보다 우선한다 ----
  var THEME_KEY = 'flowcheck-theme';
  function normalizeTheme(v) { return v === 'light' || v === 'dark' ? v : 'system'; }
  function nextTheme(cur) { cur = normalizeTheme(cur); return cur === 'system' ? 'light' : (cur === 'light' ? 'dark' : 'system'); }
  function readTheme(storage) {
    try { return storage ? normalizeTheme(storage.getItem(THEME_KEY)) : 'system'; } catch (e) { return 'system'; }
  }
  function saveTheme(storage, theme) {
    try {
      if (!storage) return false;
      if (theme === 'light' || theme === 'dark') storage.setItem(THEME_KEY, theme); else storage.removeItem(THEME_KEY);
      return true;
    } catch (e) { return false; }
  }

  var api = { normalizeTheme: normalizeTheme, nextTheme: nextTheme, readTheme: readTheme, saveTheme: saveTheme, CLASSES: CLASSES, EXAMPLE: EXAMPLE, parseCount: parseCount, analyze: analyze, checkAccuracy: checkAccuracy, fmt: fmt, parseCsv: parseCsv, buildCsv: buildCsv, KNOWN_TABLE: KNOWN_TABLE, CONFUSION: CONFUSION, deviceStats: deviceStats, lowestDevice: lowestDevice, stepMove: stepMove, PAPER_ORDER: PAPER_ORDER, STEP_TOTAL: STEP_TOTAL, SAMPLES: SAMPLES };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof document === 'undefined') return;

  // ---------- DOM ----------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  var ICON = {
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18v.5"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-7"/></svg>',
    bad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8.5 8.5 7 7m0-7-7 7"/></svg>'
  };
  function banner(kind, text) {
    var b = el('div', 'banner ' + kind);
    b.innerHTML = ICON[kind === 'bad' ? 'bad' : kind === 'info' ? 'info' : 'warn']; // 고정 문자열만 사용
    b.appendChild(el('span', null, text));
    return b;
  }

  function renderBars(res) {
    var wrap = el('div', 'bars');
    wrap.setAttribute('role', 'list');
    var order = res.shares.map(function (s, i) { return i; }).sort(function (x, y) { return res.shares[y] - res.shares[x] || x - y; });
    order.forEach(function (i) {
      var s = res.shares[i];
      var top = !res.balanced && i === res.maxIndex;   // 쏠림이 있을 때만 최다 클래스 강조
      var row = el('div', 'bar-row');
      row.setAttribute('role', 'listitem');
      row.appendChild(el('div', null, CLASSES[i] + ' (' + res.counts[i].toLocaleString('ko-KR') + '건)'));
      var track = el('div', 'track');
      var band = el('div', 'band'); band.style.left = (BASE - RANGE) + '%'; band.style.width = (RANGE * 2) + '%';
      var fill = el('div', 'fill' + (top ? ' top' : ''));
      fill.style.width = Math.min(s, 100) + '%';
      var inside = s > 85;
      var val = el('span', 'val' + (inside ? ' in' : ' out'), fmt(s) + '%');
      val.style.left = inside ? Math.min(s, 100) + '%' : 'calc(' + s + '% + 6px)';
      var mark = el('div', 'mark'); mark.style.left = BASE + '%';
      track.appendChild(band); track.appendChild(fill); track.appendChild(mark); track.appendChild(val);
      row.appendChild(track);
      wrap.appendChild(row);
    });
    wrap.appendChild(el('p', 'legend', '점선(20%) = 5종에 똑같이 나뉘면 각 20%(논문 가설 2의 기준). 옅은 띠 = 20%±10%p(앱 내 해석). 0% 기준선, 점유율 내림차순. 총 ' + res.total.toLocaleString('ko-KR') + ' Flow'));
    return wrap;
  }

  function renderResult(out, res, isPaperExample) {
    out.textContent = '';
    var d = (res.diffPP >= 0 ? '+' : '') + fmt(res.diffPP);
    if (res.balanced) {
      out.appendChild(banner('info', '고르게 나뉨 — 다만 등록되지 않은 트래픽이라면 어느 쪽이든 제대로 된 분류가 아닙니다(논문 §5.1).'));
    } else {
      out.appendChild(banner('warn', '한 기기로 몰림 — 등록되지 않은 트래픽을 억지로 분류한 모양(논문 가설 2와 같은 양상)'));
    }
    out.appendChild(el('p', null, '가장 많이 몰린 기기: ' + CLASSES[res.maxIndex] + ' ' + fmt(res.maxShare) + '% — 논문 기준 20%와의 차이 ' + d + '%p'));
    out.appendChild(renderBars(res));
    if (!res.balanced) {
      var why = '등록된 5종 안에서만 고르는 모델이라, 모르는 기기도 억지로 하나를 고릅니다(강제 분류, 논문 §4.2). ' +
        (isPaperExample ? '56.2%는 FPR이 아니라 논문이 정의한 "강제 분류 비율"입니다.' : '몰린 비율은 논문의 "강제 분류 비율"과 같은 방식으로 읽습니다(FPR이 아님).');
      out.appendChild(el('p', 'note', why));
      out.appendChild(el('p', 'note', isPaperExample
        ? '왜 BelkinCamera로 몰렸는지는 단정할 수 없습니다. 논문은 영상 스트리밍·대용량 전송 같은 트래픽 특성이 비슷해서일 수 있다고 보지만(논문의 추정, 확정 아님), 특징 기여도 분석을 하지 않았습니다(§5.2).'
        : '왜 몰렸는지는 단정할 수 없습니다(논문 §5.2).'));
    }
  }

  var fieldsBox = document.getElementById('count-fields');
  var inputs = CLASSES.map(function (name, i) {
    var d = el('div');
    var l = el('label', null, name + ' 건수'); l.setAttribute('for', 'c' + i);
    var inp = el('input'); inp.id = 'c' + i; inp.setAttribute('inputmode', 'numeric'); inp.setAttribute('autocomplete', 'off'); inp.placeholder = '예: ' + EXAMPLE[i];
    d.appendChild(l); d.appendChild(inp); fieldsBox.appendChild(d);
    return inp;
  });

  var nf = function (x) { return x.toLocaleString('en-US'); };

  // ---------- 작업 1: 등록된 기기 확인 (논문 표 3의 행) ----------
  var devButtons = [];
  function renderDevice(i) {
    var st = deviceStats(i);
    var out = document.getElementById('dev-out');
    out.textContent = '';
    out.appendChild(el('p', 'dev-line', st.name + ': 실제 ' + nf(st.total) + '건 중 ' + nf(st.correct) + '건 맞힘 (' + st.rate.toFixed(2) + '%)'));
    var bar = el('div', 'acc-bar');
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', '맞힘 ' + nf(st.correct) + '건, 틀림 ' + nf(st.wrong) + '건');
    var okSeg = el('div', 'seg-ok'); okSeg.style.width = st.rate + '%';
    var badSeg = el('div', 'seg-bad');
    bar.appendChild(okSeg); bar.appendChild(badSeg);
    out.appendChild(bar);
    var lg = el('p', 'acc-legend');
    lg.appendChild(el('span', 'sw sw-ok'));
    lg.appendChild(document.createTextNode('맞힘 ' + nf(st.correct) + '건   '));
    lg.appendChild(el('span', 'sw sw-bad'));
    lg.appendChild(document.createTextNode('틀림 ' + nf(st.wrong) + '건'));
    out.appendChild(lg);
    out.appendChild(el('p', null, '가장 많이 틀린 상대: ' + st.worstName + ' ' + nf(st.worstCount) + '건'));
    out.appendChild(el('p', 'note', '논문 표 3에서 이 기기의 행(실제)을 읽은 값입니다.' +
      (st.name === 'SamsungSmartThings' ? ' SamsungSmartThings → AmazonEcho 126건은 논문 §4.1의 설명과 같습니다.' : '')));
  }
  function selectDevice(i, focus) {
    devButtons.forEach(function (b, j) {
      b.setAttribute('aria-checked', j === i ? 'true' : 'false');
      b.tabIndex = j === i ? 0 : -1;
    });
    if (focus) devButtons[i].focus();
    renderDevice(i);
  }
  (function initDevices() {
    var group = document.getElementById('dev-group');
    PAPER_ORDER.forEach(function (name, i) {
      var b = el('button', 'seg-btn', name);
      b.type = 'button'; b.setAttribute('role', 'radio');
      b.addEventListener('click', function () { selectDevice(i, false); });
      b.addEventListener('keydown', function (ev) {
        var k = ev.key, d = 0;
        if (k === 'ArrowRight' || k === 'ArrowDown') d = 1; else if (k === 'ArrowLeft' || k === 'ArrowUp') d = -1; else return;
        ev.preventDefault();
        selectDevice((i + d + PAPER_ORDER.length) % PAPER_ORDER.length, true);
      });
      devButtons.push(b); group.appendChild(b);
    });
    var low = lowestDevice();
    var sum = document.getElementById('dev-sum');
    PAPER_ORDER.forEach(function (name, i) {
      var st = deviceStats(i);
      var li = el('li', i === low ? 'is-low' : null);
      li.appendChild(el('span', 'sum-n', name));
      li.appendChild(el('span', 'sum-v', st.rate.toFixed(2) + '%'));
      if (i === low) li.appendChild(el('span', 'sum-tag', '가장 낮음'));
      sum.appendChild(li);
    });
    selectDevice(0, false);
  })();

  // 논문 표 2·3 전체(접이식 안)
  (function renderPaperTables() {
    var box = document.getElementById('paper-tables-body');
    var wrapT = el('div', 'table-wrap');
    var t = el('table', 'metrics small');
    t.appendChild(el('caption', null, '기기별 성능 — 논문 표 2 (Precision = 그 기기라고 답한 것 중 실제로 맞은 비율, Recall = 실제 그 기기 중 맞힌 비율, F1 = 둘을 합친 점수, Support = 실제 건수. 1.00이 최고)'));
    var head = el('tr');
    ['기기', 'Precision', 'Recall', 'F1', 'Support'].forEach(function (h) { head.appendChild(el('th', null, h)); });
    var thead = el('thead'); thead.appendChild(head); t.appendChild(thead);
    var tb = el('tbody');
    KNOWN_TABLE.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('th', null, r[0]));
      [1, 2, 3].forEach(function (i) { tr.appendChild(el('td', r[0] === 'SamsungSmartThings' && i === 2 ? 'low' : null, r[i].toFixed(2))); });
      tr.appendChild(el('td', null, nf(r[4])));
      tb.appendChild(tr);
    });
    var m = el('tr', 'macro');
    m.appendChild(el('th', null, 'Macro'));
    KNOWN_MACRO.forEach(function (v) { m.appendChild(el('td', null, v.toFixed(2))); });
    m.appendChild(el('td', null, '—'));
    tb.appendChild(m);
    t.appendChild(tb); wrapT.appendChild(t); box.appendChild(wrapT);
    box.appendChild(el('p', 'note', 'SamsungSmartThings의 Recall(0.94)이 가장 낮고, 126건이 AmazonEcho로 잘못 분류됐습니다(논문 §4.1). 논문 표 2·3에는 이름이 짧게(NetatmoWeather·SmartThings·TPLinkPlug) 적혀 있으며, 이 화면은 전체 이름으로 통일했습니다.'));
    var w2 = el('div', 'table-wrap');
    var ct = el('table', 'metrics conf-t');
    ct.appendChild(el('caption', null, '혼동행렬 — 논문 표 3 (행=실제, 열=예측)'));
    var h2 = el('tr');
    h2.appendChild(el('th', null, '실제↓ 예측→'));
    PAPER_ORDER.forEach(function (n) { h2.appendChild(el('th', null, n)); });
    var th2 = el('thead'); th2.appendChild(h2); ct.appendChild(th2);
    var tb2 = el('tbody');
    CONFUSION.forEach(function (row, r) {
      var tr = el('tr');
      tr.appendChild(el('th', null, PAPER_ORDER[r]));
      row.forEach(function (v, c) { tr.appendChild(el('td', r === c ? 'diag' : (v === 126 ? 'hot' : ''), nf(v))); });
      tb2.appendChild(tr);
    });
    ct.appendChild(tb2); w2.appendChild(ct); box.appendChild(w2);
    box.appendChild(el('p', 'note', '대각선(진한 글씨)이 맞힌 건수이며 합계 12,584건. 강조 칸: SamsungSmartThings → AmazonEcho 126건.'));
  })();

  // ---------- 작업 2: 등록되지 않은 기기(PC) 따라가기 ----------
  var stepCur = 1;
  function stepContent(n) {
    var box = el('div');
    var res = analyze(EXAMPLE);
    if (n === 1) {
      box.appendChild(el('h3', 'scene-h', '① 등록된 5종'));
      box.appendChild(el('p', null, '이 모델이 학습한 기기는 아래 5종뿐입니다. "모른다"는 선택지는 없습니다(논문 §5.1).'));
      var ul = el('ul', 'chips');
      PAPER_ORDER.forEach(function (name) { ul.appendChild(el('li', null, name)); });
      box.appendChild(ul);
    } else if (n === 2) {
      box.appendChild(el('h3', 'scene-h', '② 등록되지 않은 PC의 트래픽 697 Flow를 넣음'));
      var cl = el('ul', 'cond-list');
      cl.appendChild(el('li', null, 'Windows PC 유선, 일상 사용(웹 브라우징·동영상 스트리밍·대용량 다운로드) 중 Wireshark로 약 3분 캡처'));
      cl.appendChild(el('li', null, 'scapy로 TCP/UDP 5-tuple 양방향 Flow 697개로 집계 → 같은 모델에 입력 (논문 §3.4)'));
      box.appendChild(cl);
      box.appendChild(el('p', 'note', '이 PC는 모델이 학습하지 않은(등록되지 않은) 기기입니다.'));
    } else if (n === 3) {
      box.appendChild(el('h3', 'scene-h', '③ 결과: 392건이 BelkinCamera로 분류됨'));
      box.appendChild(el('p', null, '697건 모두 5종 중 하나로 분류됐고, 392건(56.2%)이 BelkinCamera였습니다.'));
      box.appendChild(renderBars(res));
      box.appendChild(el('p', 'note', '56.2%는 FPR(오탐률)이 아니라 논문이 정의한 "강제 분류 비율"입니다(논문 §4.2).'));
    } else {
      box.appendChild(el('h3', 'scene-h', '④ 20% 기준선과 비교'));
      box.appendChild(el('p', null, '5종에 똑같이 나뉘면 각 20%입니다. BelkinCamera는 56.2%로 20%보다 +' + fmt(res.diffPP) + '%p 높습니다.'));
      var tmp = el('div'); renderResult(tmp, res, true);
      var bars = tmp.querySelector('.bars'); if (bars) bars.parentNode.removeChild(bars);
      Array.prototype.slice.call(tmp.querySelectorAll('p')).forEach(function (p) { if (p.textContent.indexOf('가장 많이 몰린 기기') === 0) p.parentNode.removeChild(p); });
      while (tmp.firstChild) box.appendChild(tmp.firstChild);
    }
    return box;
  }
  function renderStep() {
    var body = document.getElementById('step-body');
    body.textContent = '';
    body.appendChild(stepContent(stepCur));
    document.getElementById('step-status').textContent = '단계 ' + stepCur + ' / ' + STEP_TOTAL;
    document.getElementById('step-prev').disabled = stepCur === 1;
    document.getElementById('step-next').textContent = stepCur === STEP_TOTAL ? '처음부터' : '다음';
  }
  document.getElementById('step-next').addEventListener('click', function () { stepCur = stepMove(stepCur, 1); renderStep(); });
  document.getElementById('step-prev').addEventListener('click', function () {
    stepCur = stepMove(stepCur, -1); renderStep();
    if (stepCur === 1) document.getElementById('step-next').focus();   // 비활성화된 버튼에 포커스가 남지 않게
  });
  renderStep();

  document.getElementById('form-counts').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var msg = document.getElementById('counts-msg'), out = document.getElementById('counts-out');
    var res = analyze(inputs.map(function (i) { return i.value; }));
    inputs.forEach(function (i) { i.removeAttribute('aria-invalid'); });
    if (!res.ok) {
      out.textContent = '';
      msg.textContent = res.errors.map(function (e) { return e.message; }).join(' / ');
      res.errors.forEach(function (e) { if (e.index >= 0) { inputs[e.index].setAttribute('aria-invalid', 'true'); } });
      var first = res.errors[0].index; if (first >= 0) inputs[first].focus();
      return;
    }
    msg.textContent = '';
    renderResult(out, res, false);
  });

  document.getElementById('form-acc').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var inp = document.getElementById('acc'), msg = document.getElementById('acc-msg'), out = document.getElementById('acc-out');
    var r = checkAccuracy(inp.value);
    out.textContent = '';
    if (!r.ok) { msg.textContent = r.error; inp.setAttribute('aria-invalid', 'true'); return; }
    msg.textContent = ''; inp.removeAttribute('aria-invalid');
    var st = el('div', 'status');
    var badge = el('span', 'badge ' + (r.pass ? 'ok' : 'bad'));
    badge.innerHTML = r.pass ? ICON.ok : ICON.bad;
    badge.appendChild(el('span', null, r.pass ? '통과' : '미달'));
    st.appendChild(badge);
    st.appendChild(el('p', null, r.pass
      ? r.value + '%는 논문 가설 1의 기준(정확도 90% 이상)을 충족합니다.'
      : r.value + '%는 논문 가설 1의 기준(정확도 90% 이상)에 못 미칩니다.'));
    out.appendChild(st);
    out.appendChild(el('p', 'note', '정확도가 높아도 등록되지 않은 기기의 트래픽은 한 기기로 몰릴 수 있습니다. 아래 한계를 함께 읽으세요.'));
  });

  // ---------- CSV / 샘플 / 가이드 ----------
  var csvMsg = document.getElementById('csv-msg'), csvNote = document.getElementById('csv-note');
  function applyCsv(text, label) {
    csvMsg.textContent = ''; csvNote.textContent = '';
    var r = parseCsv(text);
    if (!r.ok) { csvMsg.textContent = r.error; return; }
    var n = function (x) { return x.toLocaleString('ko-KR'); };
    var base = (label ? label + ': ' : '') + n(r.rows) + '행을 집계했습니다.';
    inputs.forEach(function (inp, i) { inp.value = r.counts[i]; });
    csvNote.textContent = base +
      (r.unknown ? ' 알 수 없는 클래스 ' + n(r.unknown) + '건(5종 밖, 점유율 계산에서 제외).' : '');
    document.getElementById('counts-msg').textContent = '';
    document.getElementById('form-counts').dispatchEvent(new Event('submit', { cancelable: true }));
  }
  function loadSample(key) { applyCsv(SAMPLES[key].build(), SAMPLES[key].file); }
  Array.prototype.forEach.call(document.querySelectorAll('[data-sample]'), function (b) {
    b.addEventListener('click', function () { loadSample(b.getAttribute('data-sample')); });
  });
  document.getElementById('csv-file').addEventListener('change', function (ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    if (f.size > MAX_CSV) { csvNote.textContent = ''; csvMsg.textContent = '파일이 너무 큽니다(5MB 이하만 가능).'; return; }
    var rd = new FileReader();
    rd.onload = function () { applyCsv(String(rd.result), f.name); };
    rd.onerror = function () { csvNote.textContent = ''; csvMsg.textContent = '파일을 읽지 못했습니다.'; };
    rd.readAsText(f);
  });
  document.getElementById('btn-paste').addEventListener('click', function () {
    applyCsv(document.getElementById('csv-text').value, '붙여넣기');
  });

  // ---------- 테마 전환 버튼 ----------
  (function initTheme() {
    var btn = document.getElementById('theme-btn');
    if (!btn) return;
    var store = null;
    try { store = root.localStorage; } catch (e) { store = null; }
    var cur = readTheme(store);
    var SVG = {
      light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
      dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
      system: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/></svg>'
    };
    var LABEL = { system: '시스템', light: '라이트', dark: '다크' };
    function apply() {
      var de = document.documentElement;
      if (cur === 'system') de.removeAttribute('data-theme'); else de.setAttribute('data-theme', cur);
      btn.innerHTML = SVG[cur];   // 고정 문자열만 사용
      btn.appendChild(document.createTextNode('테마: ' + LABEL[cur]));
      btn.setAttribute('aria-label', '화면 테마: 현재 ' + LABEL[cur] + (cur === 'system' ? '(기기 설정을 따름)' : '') + '. 누르면 ' + LABEL[nextTheme(cur)] + '(으)로 바뀝니다.');
    }
    btn.addEventListener('click', function () { cur = nextTheme(cur); saveTheme(store, cur); apply(); });
    apply();
  })();
})(typeof window !== 'undefined' ? window : globalThis);
