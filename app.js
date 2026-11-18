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

  var api = { CLASSES: CLASSES, EXAMPLE: EXAMPLE, parseCount: parseCount, analyze: analyze, checkAccuracy: checkAccuracy, fmt: fmt };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof document === 'undefined') return;

  // ---------- DOM ----------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderBars(res) {
    var wrap = el('div', 'bars');
    wrap.setAttribute('role', 'list');
    res.shares.forEach(function (s, i) {
      var row = el('div', 'bar-row');
      row.setAttribute('role', 'listitem');
      row.appendChild(el('div', null, CLASSES[i] + ' (' + res.counts[i].toLocaleString('ko-KR') + '건)'));
      var track = el('div', 'track');
      var band = el('div', 'band'); band.style.left = (BASE - RANGE) + '%'; band.style.width = (RANGE * 2) + '%';
      var fill = el('div', 'fill' + (i === res.maxIndex ? ' top' : ''));
      fill.style.width = Math.min(s, 100) + '%';
      fill.appendChild(el('span', null, fmt(s) + '%'));
      var mark = el('div', 'mark'); mark.style.left = BASE + '%';
      track.appendChild(band); track.appendChild(fill); track.appendChild(mark);
      row.appendChild(track);
      wrap.appendChild(row);
    });
    wrap.appendChild(el('p', 'legend', '점선 = 논문 H2 기준 20%, 회색 띠 = 20%±10%p(앱 내 해석). 총 ' + res.total.toLocaleString('ko-KR') + ' Flow'));
    return wrap;
  }

  function renderResult(out, res, isPaperExample) {
    out.textContent = '';
    out.appendChild(renderBars(res));
    var d = (res.diffPP >= 0 ? '+' : '') + fmt(res.diffPP);
    out.appendChild(el('p', null, '가장 큰 점유율: ' + CLASSES[res.maxIndex] + ' ' + fmt(res.maxShare) + '% — 논문 기준 20%와의 차이 ' + d + '%p'));
    if (res.balanced) {
      out.appendChild(el('div', 'box ok', '고르게 분산(논문 H2 기각 조건)'));
    } else {
      out.appendChild(el('div', 'box warn', '쏠림 경고 — 쏠림 있음(논문 H2 채택 조건과 같은 양상). 논문 기준(각 클래스 20% 내외)에서 벗어났습니다.'));
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
    out.appendChild(r.pass
      ? el('div', 'box ok', '통과 — ' + r.value + '%는 논문 H1 기준(90% 이상)을 충족합니다.')
      : el('div', 'box bad', '미달 — ' + r.value + '%는 논문 H1 기준(90% 이상)에 못 미칩니다.'));
    out.appendChild(el('p', 'note', '정확도가 높아도 학습에 없던 트래픽에서는 한쪽으로 쏠릴 수 있습니다. 아래 한계를 함께 읽으세요.'));
  });
})(typeof window !== 'undefined' ? window : globalThis);
