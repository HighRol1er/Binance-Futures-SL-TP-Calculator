'use strict';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function getPrecision(priceStr) {
  const parts = String(priceStr).replace(/,/g, '').split('.');
  return parts.length > 1 ? parts[1].length : 0;
}

function calculate(price, direction, slPct, tpPct, feePct) {
  const raw = String(price).replace(/,/g, '');
  const p = parseFloat(raw);
  const sl = parseFloat(slPct) / 100;
  const tp = parseFloat(tpPct) / 100;
  const fee = parseFloat(feePct) / 100;
  if (isNaN(p) || p <= 0 || isNaN(sl) || isNaN(tp) || !direction) return null;

  const precision = getPrecision(price);
  const isLong = direction === 'long';

  // SL / TP prices
  const tpPrice = isLong ? p * (1 + tp) : p * (1 - tp);
  const slPrice = isLong ? p * (1 - sl) : p * (1 + sl);

  // Break Even: entry × (1 ± 2×fee)
  const bePrice = isLong ? p * (1 + 2 * fee) : p * (1 - 2 * fee);

  // R:R ratio (net of fees)
  const netTp = tp - 2 * fee;
  const netSl = sl + 2 * fee;
  const rr = netSl > 0 ? netTp / netSl : null;

  // EV at 50% win rate, net of fees
  const ev = 0.5 * netTp - 0.5 * netSl;   // as decimal (e.g. 0.004 = 0.4%)

  // 최소 승률: EV = 0 이 되는 p = netSl / (netTp + netSl)
  const minWinRate = (netTp + netSl) > 0 ? netSl / (netTp + netSl) : null;

  return {
    tp: tpPrice.toFixed(precision),
    sl: slPrice.toFixed(precision),
    be: bePrice.toFixed(precision),
    rr,
    ev,
    minWinRate,
  };
}

function formatPrice(val) {
  if (val === null || val === undefined || val === '—') return '—';
  const n = parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(n)) return '—';
  const precision = getPrecision(val);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

// ──────────────────────────────────────────────
// DOM refs
// ──────────────────────────────────────────────

const dirSwitch      = document.getElementById('dir-switch');
const dirSwitchLabel = document.getElementById('dir-switch-label');
const currentPriceEl = document.getElementById('current-price');
const slPctInput     = document.getElementById('sl-pct');
const tpPctInput     = document.getElementById('tp-pct');
const feePctInput    = document.getElementById('fee-pct');
const saveBtn        = document.getElementById('save-btn');
const saveMsg        = document.getElementById('save-msg');
const tpValueEl      = document.getElementById('tp-value');
const slValueEl      = document.getElementById('sl-value');
const tpPctDisplay   = document.getElementById('tp-pct-display');
const slPctDisplay   = document.getElementById('sl-pct-display');
const beValueEl      = document.getElementById('be-value');
const rrValueEl      = document.getElementById('rr-value');
const evValueEl      = document.getElementById('ev-value');
const minWrValueEl   = document.getElementById('minwr-value');
const statusFooter   = document.getElementById('status-footer');
const copyTpBtn      = document.getElementById('copy-tp');
const copySlBtn      = document.getElementById('copy-sl');
const copyBeBtn      = document.getElementById('copy-be');

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────

let state = {
  price: null,
  direction: 'long',
  slPct: 1,
  tpPct: 1,
  feePct: 0.05,
};

// ──────────────────────────────────────────────
// Render
// ──────────────────────────────────────────────

function updateDirectionButtons(direction) {
  dirSwitch.className = 'dir-switch dir-switch--' + (direction === 'short' ? 'short' : 'long');
  dirSwitchLabel.textContent = direction === 'short' ? 'SHORT' : 'LONG';
}

function render() {
  const { price, direction, slPct, tpPct, feePct } = state;

  updateDirectionButtons(direction);

  if (price) {
    currentPriceEl.textContent = formatPrice(price);
    statusFooter.textContent = '실시간 감지 중';
  } else {
    currentPriceEl.textContent = '—';
    statusFooter.textContent = 'Price 입력창에 값을 입력하세요';
  }

  tpPctDisplay.textContent = `+${tpPct}%`;
  slPctDisplay.textContent = `-${slPct}%`;

  const result = calculate(price, direction, slPct, tpPct, feePct);
  if (result) {
    tpValueEl.textContent = formatPrice(result.tp);
    slValueEl.textContent = formatPrice(result.sl);
    beValueEl.textContent = formatPrice(result.be);

    if (result.rr !== null) {
      rrValueEl.innerHTML =
        `<span style="color:var(--red)">1</span>` +
        `<span style="color:var(--text-secondary)"> : </span>` +
        `<span style="color:var(--green)">${result.rr.toFixed(2)}</span>`;
    } else {
      rrValueEl.innerHTML = '—';
    }

    const evPct = (result.ev * 100).toFixed(3);
    evValueEl.textContent = (result.ev >= 0 ? '+' : '') + evPct + '%';
    evValueEl.style.color = result.ev >= 0 ? 'var(--green)' : 'var(--red)';

    if (result.minWinRate !== null) {
      const mw = (result.minWinRate * 100).toFixed(1);
      minWrValueEl.textContent = mw + '%';
      // 50% 미만: 유리(초록), 50~60%: 주의(노랑), 60% 초과: 불리(빨강)
      minWrValueEl.style.color =
        result.minWinRate < 0.5  ? 'var(--green)' :
        result.minWinRate < 0.6  ? 'var(--yellow)' : 'var(--red)';
    } else {
      minWrValueEl.textContent = '—';
      minWrValueEl.style.color = '';
    }
  } else {
    tpValueEl.textContent   = '—';
    slValueEl.textContent   = '—';
    beValueEl.textContent   = '—';
    rrValueEl.innerHTML     = '—';
    evValueEl.textContent   = '—';
    minWrValueEl.textContent = '—';
    rrValueEl.style.color   = '';
    evValueEl.style.color   = '';
    minWrValueEl.style.color = '';
  }
}

// ──────────────────────────────────────────────
// Direction toggle
// ──────────────────────────────────────────────

function setDirection(dir) {
  state.direction = dir;
  chrome.storage.local.set({ direction: dir, updatedAt: Date.now() });
  render();
}

dirSwitch.addEventListener('click', () => {
  setDirection(state.direction === 'long' ? 'short' : 'long');
});

// ──────────────────────────────────────────────
// Storage
// ──────────────────────────────────────────────

function loadAll() {
  chrome.storage.sync.get({ slPct: 1, tpPct: 1, feePct: 0.05 }, (syncData) => {
    state.slPct  = parseFloat(syncData.slPct)  || 1;
    state.tpPct  = parseFloat(syncData.tpPct)  || 1;
    state.feePct = parseFloat(syncData.feePct) ?? 0.05;
    slPctInput.value  = state.slPct;
    tpPctInput.value  = state.tpPct;
    feePctInput.value = state.feePct;

    chrome.storage.local.get(['price', 'direction', 'updatedAt'], (localData) => {
      state.price = localData.price || null;
      if (localData.direction) state.direction = localData.direction;
      render();
    });
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.price !== undefined) state.price = changes.price.newValue || null;
    if (changes.direction?.newValue) state.direction = changes.direction.newValue;
    render();
  }
  if (area === 'sync') {
    if (changes.slPct)  { state.slPct  = changes.slPct.newValue;  slPctInput.value  = state.slPct; }
    if (changes.tpPct)  { state.tpPct  = changes.tpPct.newValue;  tpPctInput.value  = state.tpPct; }
    if (changes.feePct) { state.feePct = changes.feePct.newValue; feePctInput.value = state.feePct; }
    render();
  }
});

// ──────────────────────────────────────────────
// Save settings
// ──────────────────────────────────────────────

saveBtn.addEventListener('click', () => {
  const sl  = parseFloat(slPctInput.value);
  const tp  = parseFloat(tpPctInput.value);
  const fee = parseFloat(feePctInput.value);

  if (isNaN(sl)  || sl  < 0.01 || sl  > 99.99) { showSaveMsg('SL: 0.01 ~ 99.99 사이 값을 입력하세요', true); return; }
  if (isNaN(tp)  || tp  < 0.01 || tp  > 99.99) { showSaveMsg('TP: 0.01 ~ 99.99 사이 값을 입력하세요', true); return; }
  if (isNaN(fee) || fee < 0    || fee > 10)     { showSaveMsg('Fee: 0 ~ 10 사이 값을 입력하세요', true); return; }

  state.slPct = sl; state.tpPct = tp; state.feePct = fee;
  chrome.storage.sync.set({ slPct: sl, tpPct: tp, feePct: fee }, () => {
    showSaveMsg('저장됨', false);
    render();
  });
});

function showSaveMsg(msg, isError) {
  saveMsg.textContent = msg;
  saveMsg.className = 'save-msg ' + (isError ? 'save-msg--error' : 'save-msg--ok');
  setTimeout(() => { saveMsg.textContent = ''; saveMsg.className = 'save-msg'; }, 2000);
}

// ──────────────────────────────────────────────
// Copy buttons
// ──────────────────────────────────────────────

function copyEl(btn, el) {
  const text = el.textContent.trim().replace(/,/g, '').replace(/[^0-9.+-]/g, '');
  if (!text || text === '—') return;
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
  });
}

copyTpBtn.addEventListener('click', () => copyEl(copyTpBtn, tpValueEl));
copySlBtn.addEventListener('click', () => copyEl(copySlBtn, slValueEl));
copyBeBtn.addEventListener('click', () => copyEl(copyBeBtn, beValueEl));

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', loadAll);
