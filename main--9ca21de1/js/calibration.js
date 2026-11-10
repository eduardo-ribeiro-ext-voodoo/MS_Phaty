// ============================================================
// calibration.js — Calibration panel sliders
// ============================================================

var calPanel = document.getElementById('cal-panel');
var calVisible = false;

function toggleCal() {
  calVisible = !calVisible;
  calPanel.style.display = calVisible ? 'block' : 'none';
}
document.getElementById('cal-toggle').addEventListener('click', toggleCal);

document.getElementById('gravSlider').addEventListener('input', function () {
  PHYS_GRAVITY = parseInt(this.value) / 100;
  document.getElementById('gravVal').textContent = this.value;
});
document.getElementById('beltSlider').addEventListener('input', function () {
  BELT_SPEED = parseInt(this.value) / 10000;
  document.getElementById('beltVal').textContent = this.value;
});
document.getElementById('lipSlider').addEventListener('input', function () {
  LIP_PCT = parseInt(this.value) / 100;
  document.getElementById('lipVal').textContent = this.value;
});
document.getElementById('mrbGapSlider').addEventListener('input', function () {
  MRB_GAP_FACTOR = parseInt(this.value) / 100;
  document.getElementById('mrbGapVal').textContent = this.value;
});

function hookCal(id, obj, key, factor) {
  var el = document.getElementById(id);
  var valEl = document.getElementById(id + '-v');
  if (!el) return;
  el.addEventListener('input', function () {
    obj[key] = parseFloat(el.value) * factor;
    valEl.textContent = el.value;
    computeLayout();
    updateStockPositions();
  });
}
hookCal('cs-dx', cal.stock, 'dx', 1); hookCal('cs-dy', cal.stock, 'dy', 1); hookCal('cs-s', cal.stock, 's', 0.01);
hookCal('cf-dx', cal.funnel, 'dx', 1); hookCal('cf-dy', cal.funnel, 'dy', 1); hookCal('cf-sw', cal.funnel, 'sw', 0.01); hookCal('cf-sh', cal.funnel, 'sh', 0.01);
hookCal('cb-dx', cal.belt, 'dx', 1); hookCal('cb-dy', cal.belt, 'dy', 1); hookCal('cb-sw', cal.belt, 'sw', 0.01); hookCal('cb-sh', cal.belt, 'sh', 0.01);
hookCal('co-dx', cal.sort, 'dx', 1); hookCal('co-dy', cal.sort, 'dy', 1); hookCal('co-s', cal.sort, 's', 0.01);
hookCal('cm-s', cal.marble, 's', 0.01);
hookCal('cbk-dx', cal.back, 'dx', 1); hookCal('cbk-dy', cal.back, 'dy', 1); hookCal('cbk-s', cal.back, 's', 0.01);
