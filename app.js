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
  // 표 3의 열 합계 = 예측 분포(CLASSES 순서로 변환)
  function knownPredictedCounts() {
    var cols = PAPER_ORDER.map(function (n, c) { return CONFUSION.reduce(function (s, row) { return s + row[c]; }, 0); });
    return CLASSES.map(function (n) { return cols[PAPER_ORDER.indexOf(n)]; });
  }

  var api = { CLASSES: CLASSES, EXAMPLE: EXAMPLE, parseCount: parseCount, analyze: analyze, checkAccuracy: checkAccuracy, fmt: fmt, parseCsv: parseCsv, buildCsv: buildCsv, KNOWN_TABLE: KNOWN_TABLE, CONFUSION: CONFUSION, knownPredictedCounts: knownPredictedCounts, SAMPLES: SAMPLES };
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

  function condBox(title, lines) {
    var box = el('div', 'cond');
    box.appendChild(el('b', null, title));
    var ul = el('ul');
    lines.forEach(function (l) { ul.appendChild(el('li', null, l)); });
    box.appendChild(ul);
    return box;
  }

  function renderKnownScene(box) {
    box.appendChild(el('h3', 'scene-h', 'ⓐ 등록된 기기(5종)의 트래픽 — 잘 맞힘(내부 테스트)'));
    box.appendChild(condBox('테스트 조건 (논문 §3)', [
      'UNSW-IoTraffic 5종 기기 Flow를 클래스당 12,816건으로 언더샘플링(총 64,080건), 80/20 계층 분할(테스트 12,816건, 클래스당 약 2,563건)',
      '랜덤 포레스트(n_estimators=100, random_state=42), 입력은 8개 특징(IP·MAC·타임스탬프 제외)'
    ]));
    var big = el('p', 'big-stat');
    big.appendChild(el('b', null, '정확도 98.19%'));
    big.appendChild(document.createTextNode(' (12,584 / 12,816) — 논문 §4.1, 가설 1(정확도 90% 이상) 채택'));
    box.appendChild(big);

    var pred = knownPredictedCounts();
    var res = analyze(pred);
    box.appendChild(el('p', 'sub-h', '예측 분포 (논문 표 3의 열 합계로 계산, 총 12,816건)'));
    box.appendChild(renderBars(res));
    box.appendChild(el('p', null, '정답은 각 클래스 약 20%(2,563~2,564건) — 예측도 약 20%씩으로 고르게 나뉩니다(논문 표 3 열 합계로 계산).'));

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
      tr.appendChild(el('td', null, r[4].toLocaleString('en-US')));
      tb.appendChild(tr);
    });
    var m = el('tr', 'macro');
    m.appendChild(el('th', null, 'Macro'));
    KNOWN_MACRO.forEach(function (v) { m.appendChild(el('td', null, v.toFixed(2))); });
    m.appendChild(el('td', null, '—'));
    tb.appendChild(m);
    t.appendChild(tb); wrapT.appendChild(t); box.appendChild(wrapT);
    box.appendChild(el('p', 'note', 'SamsungSmartThings의 Recall(0.94)이 가장 낮고, 126건이 AmazonEcho로 잘못 분류됐습니다(논문 §4.1). 논문 표 2·3에는 이름이 짧게(NetatmoWeather·SmartThings·TPLinkPlug) 적혀 있으며, 이 화면은 전체 이름으로 통일했습니다.'));

    var det = el('details', 'conf');
    det.appendChild(el('summary', null, '논문 표 3 혼동행렬 보기 (행=실제, 열=예측)'));
    var w2 = el('div', 'table-wrap');
    var ct = el('table', 'metrics conf-t');
    var h2 = el('tr');
    h2.appendChild(el('th', null, '실제↓ 예측→'));
    PAPER_ORDER.forEach(function (n) { h2.appendChild(el('th', null, n)); });
    var th2 = el('thead'); th2.appendChild(h2); ct.appendChild(th2);
    var tb2 = el('tbody');
    CONFUSION.forEach(function (row, r) {
      var tr = el('tr');
      tr.appendChild(el('th', null, PAPER_ORDER[r]));
      row.forEach(function (v, c) {
        var cls = r === c ? 'diag' : (v === 126 ? 'hot' : '');
        tr.appendChild(el('td', cls, v.toLocaleString('en-US')));
      });
      tb2.appendChild(tr);
    });
    ct.appendChild(tb2); w2.appendChild(ct); det.appendChild(w2);
    det.appendChild(el('p', 'note', '대각선(진한 글씨)이 맞힌 건수이며 합계 12,584건. 강조 칸: SamsungSmartThings → AmazonEcho 126건.'));
    box.appendChild(det);
  }

  document.getElementById('btn-example').addEventListener('click', function () {
    var out = document.getElementById('example-out');
    out.textContent = '';
    var a = el('div', 'scene'); renderKnownScene(a); out.appendChild(a);
    out.appendChild(el('p', 'bridge', '모델은 등록된 기기는 잘 맞히지만, 등록되지 않은 기기도 "모르겠다"고 하지 못하고 등록된 기기 중 하나로 분류해 버립니다(논문 §4.2·§5.1).'));
    var b = el('div', 'scene');
    b.appendChild(el('h3', 'scene-h', 'ⓑ 등록되지 않은 기기(PC)의 트래픽 — 등록된 기기로 잘못 분류됨(강제 분류)'));
    b.appendChild(condBox('테스트 조건 (논문 §3)', [
      'Windows PC 유선, 일상 사용(웹 브라우징·동영상 스트리밍·대용량 다운로드) 중 Wireshark로 약 3분 캡처(2026-11-05)',
      'scapy로 TCP/UDP 5-tuple 양방향 Flow 697개로 집계 → 같은 모델에 입력(학습 때의 원-핫 컬럼에 reindex)'
    ]));
    var body = el('div'); renderResult(body, analyze(EXAMPLE), true); b.appendChild(body);
    out.appendChild(b);
  });

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
  var go = document.getElementById('btn-try');
  if (go) go.addEventListener('click', function () {
    loadSample('paper_pc');
    document.getElementById('h-in').scrollIntoView({ behavior: 'smooth' });
  });
})(typeof window !== 'undefined' ? window : globalThis);
