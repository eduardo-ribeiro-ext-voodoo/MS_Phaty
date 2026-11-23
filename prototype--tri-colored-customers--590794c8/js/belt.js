// ============================================================
// belt.js — Belt slot initialization and position helpers
// ============================================================

function initBeltSlots() {
  beltSlots = [];
  for (var i = 0; i < BELT_SLOTS; i++) beltSlots.push({ marble: -1, arriveAnim: 0 });
  beltOffset = 0;
}

function getSlotPos(i) {
  var t = ((i / BELT_SLOTS) + beltOffset) % 1;
  t = ((t % 1) + 1) % 1;
  var idx = t * beltPath.length;
  var i0 = Math.floor(idx) % beltPath.length;
  var i1 = (i0 + 1) % beltPath.length;
  var f = idx - Math.floor(idx);
  return {
    x: beltPath[i0].x + (beltPath[i1].x - beltPath[i0].x) * f,
    y: beltPath[i0].y + (beltPath[i1].y - beltPath[i0].y) * f
  };
}

function getSlotT(i) {
  return ((i / BELT_SLOTS) + beltOffset) % 1;
}

function getBeltEntryT() {
  var best = 0, bd = Infinity;
  for (var i = 0; i < beltPath.length; i++) {
    var dx = beltPath[i].x - L.beltCx, dy = beltPath[i].y - L.beltTopY;
    var d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = i; }
  }
  return best / beltPath.length;
}
