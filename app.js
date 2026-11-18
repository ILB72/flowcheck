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
    balanced: { file: 'sample_balanced.csv', counts: [20, 20, 20, 20, 20] },
    mild: { file: 'sample_mild.csv', counts: [35, 25, 20, 12, 8] },
    paper_pc: { file: 'sample_paper_pc.csv', counts: EXAMPLE.slice() }
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
    var lines = text.replace(/^﻿/, '').split(/\r\n|\n|\r/).filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) return { ok: false, error: '빈 파일입니다. 첫 줄에 predicted, 그 아래 한 줄에 클래스명 하나씩 넣어 주세요.' };
    var clean = function (v) { return v.trim().replace(/^"|"$/g, '').trim(); };
    var header = lines[0].split(',').map(function (v) { return clean(v).toLowerCase(); });
    var col = header.indexOf('predicted');
    if (col < 0) return { ok: false, error: '헤더가 없습니다. 첫 줄에 predicted 열이 있어야 합니다.' };
    var counts = [0, 0, 0, 0, 0], unknown = 0, names = CLASSES.map(function (c) { return c.toLowerCase(); });
    var rows = lines.length - 1;
    for (var i = 1; i < lines.length; i++) {
      var v = clean(lines[i].split(',')[col] || '').toLowerCase();
      var k = names.indexOf(v);
      if (k < 0 && ALIASES.hasOwnProperty(v)) k = ALIASES[v];
      if (k >= 0) counts[k]++; else unknown++;
    }
    if (rows === 0) return { ok: false, error: '데이터 행이 없습니다. predicted 아래에 클래스명을 넣어 주세요.' };
    return { ok: true, counts: counts, unknown: unknown, rows: rows };
  }

  var api = { CLASSES: CLASSES, EXAMPLE: EXAMPLE, parseCount: parseCount, analyze: analyze, checkAccuracy: checkAccuracy, fmt: fmt, parseCsv: parseCsv, buildCsv: buildCsv, SAMPLES: SAMPLES };
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
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18v.5"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-7"/></svg>',
    bad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8.5 8.5 7 7m0-7-7 7"/></svg>'
  };
  function banner(kind, text) {
    var b = el('div', 'banner ' + kind);
    b.innerHTML = ICON[kind === 'bad' ? 'bad' : kind === 'ok' ? 'ok' : 'warn']; // 고정 문자열만 사용
    b.appendChild(el('span', null, text));
    return b;
  }

  function renderBars(res) {
    var wrap = el('div', 'bars');
    wrap.setAttribute('role', 'list');
    var order = res.shares.map(function (s, i) { return i; }).sort(function (x, y) { return res.shares[y] - res.shares[x] || x - y; });
    order.forEach(function (i) {
      var s = res.shares[i];
      var row = el('div', 'bar-row');
      row.setAttribute('role', 'listitem');
      row.appendChild(el('div', null, CLASSES[i] + ' (' + res.counts[i].toLocaleString('ko-KR') + '건)'));
      var track = el('div', 'track');
      var band = el('div', 'band'); band.style.left = (BASE - RANGE) + '%'; band.style.width = (RANGE * 2) + '%';
      var fill = el('div', 'fill' + (i === res.maxIndex ? ' top' : ''));
      fill.style.width = Math.min(s, 100) + '%';
      var inside = s > 85;
      var val = el('span', 'val' + (inside ? ' in' : ' out') + (i === res.maxIndex ? ' top-val' : ''), fmt(s) + '%');
      val.style.left = inside ? Math.min(s, 100) + '%' : 'calc(' + s + '% + 6px)';
      var mark = el('div', 'mark'); mark.style.left = BASE + '%';
      track.appendChild(band); track.appendChild(fill); track.appendChild(mark); track.appendChild(val);
      row.appendChild(track);
      wrap.appendChild(row);
    });
    wrap.appendChild(el('p', 'legend', '0% 기준선 / 점선 = 논문 H2 기준 20%, 옅은 띠 = 20%±10%p(앱 내 해석). 점유율 내림차순. 총 ' + res.total.toLocaleString('ko-KR') + ' Flow'));
    return wrap;
  }

  function renderResult(out, res, isPaperExample) {
    out.textContent = '';
    var d = (res.diffPP >= 0 ? '+' : '') + fmt(res.diffPP);
    if (res.balanced) {
      out.appendChild(banner('ok', '고르게 분산(논문 H2 기각 조건)'));
    } else {
      out.appendChild(banner('warn', '쏠림 경고 — 쏠림 있음(논문 H2 채택 조건과 같은 양상). 논문 기준(각 클래스 20% 내외)에서 벗어났습니다.'));
    }
    out.appendChild(el('p', null, '가장 큰 점유율: ' + CLASSES[res.maxIndex] + ' ' + fmt(res.maxShare) + '% — 논문 기준 20%와의 차이 ' + d + '%p'));
    out.appendChild(renderBars(res));
    if (!res.balanced) {
      var ratio = isPaperExample
        ? '논문 예시에서 BelkinCamera 56.2%는 FPR이 아니라 논문이 정의한 "강제 분류 비율"입니다. 학습에 없던 트래픽이 한 클래스로 몰려 분류된 정도를 뜻합니다.'
        : '가장 큰 클래스로 몰린 비율은 논문의 "강제 분류 비율"과 같은 방식으로 읽을 수 있습니다(FPR이 아님).';
      out.appendChild(el('p', 'note', ratio + ' 원인은 단정할 수 없습니다(아래 한계 참고).'));
    }
    out.appendChild(el('p', 'note', '※ "20% 내외"는 논문에 수치 범위가 없어 앱에서 ±10%p로 해석한 값입니다.'));
  }

  var fieldsBox = document.getElementById('count-fields');
  var inputs = CLASSES.map(function (name, i) {
    var d = el('div');
    var l = el('label', null, name + ' 건수'); l.setAttribute('for', 'c' + i);
    var inp = el('input'); inp.id = 'c' + i; inp.setAttribute('inputmode', 'numeric'); inp.setAttribute('autocomplete', 'off'); inp.placeholder = '예: ' + EXAMPLE[i];
    d.appendChild(l); d.appendChild(inp); fieldsBox.appendChild(d);
    return inp;
  });

  document.getElementById('btn-example').addEventListener('click', function () {
    renderResult(document.getElementById('example-out'), analyze(EXAMPLE), true);
  });

  document.getElementById('btn-fill').addEventListener('click', function () {
    inputs.forEach(function (inp, i) { inp.value = EXAMPLE[i]; inp.removeAttribute('aria-invalid'); });
    document.getElementById('counts-msg').textContent = '';
    document.getElementById('form-counts').dispatchEvent(new Event('submit', { cancelable: true }));
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
      ? '통과 — ' + r.value + '%는 논문 H1 기준(90% 이상)을 충족합니다.'
      : '미달 — ' + r.value + '%는 논문 H1 기준(90% 이상)에 못 미칩니다.'));
    out.appendChild(st);
    out.appendChild(el('p', 'note', '정확도가 높아도 학습에 없던 트래픽에서는 한쪽으로 쏠릴 수 있습니다. 아래 한계를 함께 읽으세요.'));
  });

  // ---------- CSV / 샘플 / 가이드 ----------
  var csvMsg = document.getElementById('csv-msg'), csvNote = document.getElementById('csv-note');
  function applyCsv(text, label) {
    csvMsg.textContent = ''; csvNote.textContent = '';
    var r = parseCsv(text);
    if (!r.ok) { csvMsg.textContent = r.error; return; }
    inputs.forEach(function (inp, i) { inp.value = r.counts[i]; });
    csvNote.textContent = (label ? label + ': ' : '') + r.rows.toLocaleString('ko-KR') + '행을 집계했습니다.' +
      (r.unknown ? ' 알 수 없는 클래스 ' + r.unknown.toLocaleString('ko-KR') + '건(5종 밖, 점유율 계산에서 제외).' : '');
    document.getElementById('counts-msg').textContent = '';
    document.getElementById('form-counts').dispatchEvent(new Event('submit', { cancelable: true }));
  }
  function loadSample(key) { applyCsv(buildCsv(SAMPLES[key].counts), SAMPLES[key].file); }
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
