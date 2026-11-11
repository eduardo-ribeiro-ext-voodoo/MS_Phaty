// ============================================================
// treadmill.js — Treadmill mechanic: closed loops of cells
//   under the boxes. Every pick moves every loop one cell
//   forward (boxes AND gaps). Taps are blocked while sliding.
//   If no box can be picked, the loops step on their own until
//   one can ("catch-up"); if no number of steps helps, a
//   "Stuck" banner shows.
//
// Level data: lvl.treadmills = [[cellIdx, cellIdx, ...], ...]
//   Each list is a closed loop in travel order: a box on
//   loop[k] moves to loop[k+1], and the last cell feeds the first.
// ============================================================

var TM_SLIDE_FRAMES = 12;      // ~0.2 s per normal step
var TM_CATCHUP_FRAMES = 8;     // ~0.13 s per catch-up step
var TM_STUCK_DELAY = 40;       // frames of "no pick" before catch-up kicks in
var TM_MAX_LOOPS = 3;
var TM_MAX_CELLS = 30;
var TM_BOX_SCALE = 0.84;       // boxes sit slightly smaller so the belt shows around them

var tmLoops = [];              // validated loops for the current level
var tmCellInfo = {};           // cellIdx -> { loop, k, next, prev }
var tmSliding = false, tmSlideT = 0, tmSlideFrames = TM_SLIDE_FRAMES, tmIsCatchup = false;
var tmPendingStep = 0, tmCatchupLeft = 0;
var tmStuckFrames = 0, tmStuckShown = false, tmStuckT = 0;
var tmIntroT = 0, tmFlow = 0, tmBeatT = 0;

// ── Shared helpers (also used by the editor) ──

function tmAdjacent(a, b, cols) {
  var ar = Math.floor(a / cols), ac = a % cols, br = Math.floor(b / cols), bc = b % cols;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

// Returns '' if the loop is valid, otherwise a plain-language reason.
function tmLoopError(loop, cols) {
  if (!loop || loop.length < 4) return 'A treadmill needs at least 4 cells';
  var seen = {};
  for (var k = 0; k < loop.length; k++) {
    if (seen[loop[k]]) return 'A treadmill can\'t cross itself';
    seen[loop[k]] = true;
    if (!tmAdjacent(loop[k], loop[(k + 1) % loop.length], cols)) return 'The loop isn\'t closed';
  }
  return '';
}

function tmGcd(a, b) { while (b) { var t = b; b = a % b; a = t; } return a; }

// ── Level setup ──

function tmInit(lvl) {
  tmLoops = []; tmCellInfo = {};
  tmSliding = false; tmSlideT = 0; tmIsCatchup = false;
  tmPendingStep = 0; tmCatchupLeft = 0;
  tmStuckFrames = 0; tmStuckShown = false; tmStuckT = 0;
  tmIntroT = 0; tmBeatT = 0;
  if (!lvl || !lvl.treadmills) return;
  var used = {};
  for (var li = 0; li < lvl.treadmills.length && tmLoops.length < TM_MAX_LOOPS; li++) {
    var loop = lvl.treadmills[li];
    if (tmLoopError(loop, L.cols)) continue;
    var ok = true;
    for (var k = 0; k < loop.length; k++) {
      var s = stock[loop[k]];
      if (!s || s.isWall || s.isTunnel || used[loop[k]]) { ok = false; break; }
    }
    if (!ok) continue;
    var copy = loop.slice();
    var n = copy.length;
    for (var k2 = 0; k2 < n; k2++) {
      used[copy[k2]] = true;
      tmCellInfo[copy[k2]] = { loop: tmLoops.length, k: k2, next: copy[(k2 + 1) % n], prev: copy[(k2 - 1 + n) % n] };
    }
    tmLoops.push(copy);
  }
  if (tmLoops.length) tmIntroT = 1;
}

function tmIsCell(i) { return tmCellInfo[i] !== undefined; }
function tmBusy() { return tmSliding || tmPendingStep > 0 || tmCatchupLeft > 0; }
// Reveals are only judged once the treadmill has stopped.
function tmRevealLocked() { return tmSliding || tmCatchupLeft > 0; }

function tmCellXY(idx) {
  var r = Math.floor(idx / L.cols), c = idx % L.cols;
  return { x: L.sx + c * (L.bw + L.bg), y: L.sy + r * (L.bh + L.bg) };
}

// Called by handleTap after a pick has fully resolved (ice damage etc.)
function tmOnPick() {
  if (!tmLoops.length) return;
  tmPendingStep = 1;      // steps never queue up
  tmStuckShown = false;
}

// Move every loop one cell forward (in the stock array) and start the slide.
function tmPermute(arr) {
  for (var li = 0; li < tmLoops.length; li++) {
    var loop = tmLoops[li], n = loop.length;
    var old = [];
    for (var k = 0; k < n; k++) old.push(arr[loop[k]]);
    for (var k2 = 0; k2 < n; k2++) arr[loop[(k2 + 1) % n]] = old[k2];
  }
}

function tmStep(isCatchup) {
  tmPermute(stock);
  for (var li = 0; li < tmLoops.length; li++) {
    var loop = tmLoops[li];
    for (var k = 0; k < loop.length; k++) {
      var o = stock[loop[k]];
      var p = tmCellXY(loop[k]);
      o.tmFromX = o.x; o.tmFromY = o.y; o.tmToX = p.x; o.tmToY = p.y;
    }
  }
  tmSliding = true; tmSlideT = 0; tmIsCatchup = isCatchup;
  tmSlideFrames = isCatchup ? TM_CATCHUP_FRAMES : TM_SLIDE_FRAMES;
  tmBeatT = 1;
  if (isCatchup) sfx.tmCatchup(); else sfx.tmStep();
}

// Work out on the board data how many steps give the player a pick.
// Checks until every loop is back where it started (LCM of loop lengths).
function tmFindStepsToPick() {
  var period = 1;
  for (var li = 0; li < tmLoops.length; li++) {
    var n = tmLoops[li].length;
    period = period / tmGcd(period, n) * n;
    if (period > 600) { period = 600; break; }
  }
  var cur = stock.slice();
  for (var s = 1; s <= period; s++) {
    tmPermute(cur);
    var open = computeOpenCells(cur);
    for (var i = 0; i < cur.length; i++) {
      var b = cur[i];
      if (b.isWall || b.isTunnel || b.empty || b.used || b.spawning) continue;
      if (b.iceHP > 0) continue;
      if (open[i]) return s;
    }
  }
  return 0;
}

// ── Per-frame update (called from game.js update) ──

function tmUpdate() {
  if (!tmLoops.length) return;
  tmFlow += 1;
  if (tmIntroT > 0) tmIntroT = Math.max(0, tmIntroT - 1 / 90);
  if (tmBeatT > 0) tmBeatT = Math.max(0, tmBeatT - 0.06);
  if (tmStuckT > 0 && !tmStuckShown) tmStuckT = Math.max(0, tmStuckT - 0.05);
  else if (tmStuckShown && tmStuckT < 1) tmStuckT = Math.min(1, tmStuckT + 0.05);

  // 1. Animate an ongoing slide
  if (tmSliding) {
    tmSlideT = Math.min(1, tmSlideT + 1 / tmSlideFrames);
    var e = tmSlideT < 0.5 ? 2 * tmSlideT * tmSlideT : 1 - Math.pow(-2 * tmSlideT + 2, 2) / 2;
    for (var li = 0; li < tmLoops.length; li++) {
      var loop = tmLoops[li];
      for (var k = 0; k < loop.length; k++) {
        var o = stock[loop[k]];
        if (o.tmFromX === undefined) continue;
        o.x = o.tmFromX + (o.tmToX - o.tmFromX) * e;
        o.y = o.tmFromY + (o.tmToY - o.tmFromY) * e;
      }
    }
    if (tmSlideT >= 1) {
      tmSliding = false;
      for (var li2 = 0; li2 < tmLoops.length; li2++) {
        var loop2 = tmLoops[li2];
        for (var k2 = 0; k2 < loop2.length; k2++) {
          var o2 = stock[loop2[k2]];
          var p = tmCellXY(loop2[k2]);
          o2.x = p.x; o2.y = p.y;
          o2.tmFromX = undefined;
        }
      }
      if (tmIsCatchup && tmCatchupLeft > 0) {
        tmCatchupLeft--;
        if (tmCatchupLeft > 0) { tmStep(true); return; }
      }
      updateBoxReveals(true);
    }
    return;
  }

  // 2. A pick happened: step once any tunnel spawn has landed
  if (tmPendingStep > 0) {
    for (var t = 0; t < stock.length; t++) if (stock[t].isTunnel && stock[t].tunnelSpawning) return;
    tmPendingStep = 0;
    tmStep(false);
    return;
  }

  // 3. Stuck check → catch-up
  if (won) { tmStuckFrames = 0; return; }
  var active = 0, pickable = false, busy = false;
  for (var i = 0; i < stock.length; i++) {
    var b = stock[i];
    if (b.isTunnel) { if (b.tunnelSpawning) busy = true; continue; }
    if (b.isWall || b.empty || b.used) continue;
    if (b.spawning) { busy = true; continue; }
    active++;
    if (b.revealed && b.iceHP <= 0) pickable = true;
  }
  if (busy || active === 0 || pickable) { tmStuckFrames = 0; if (pickable) tmStuckShown = false; return; }
  if (tmStuckShown) return;
  tmStuckFrames++;
  if (tmStuckFrames < TM_STUCK_DELAY) return;
  tmStuckFrames = 0;
  var steps = tmFindStepsToPick();
  if (steps > 0) {
    tmCatchupLeft = steps;
    tmStep(true);
  } else {
    tmStuckShown = true;   // last resort: tell the player instead of freezing silently
  }
}

// ── Drawing ──

function tmCellCenter(idx) {
  var p = tmCellXY(idx);
  return { x: p.x + L.bw / 2, y: p.y + L.bh / 2 };
}

function tmLoopAlive(loop) {
  for (var k = 0; k < loop.length; k++) {
    var b = stock[loop[k]];
    if (!b.empty && !b.used) return true;
  }
  // A tunnel that still has boxes and faces this loop can feed it
  for (var i = 0; i < stock.length; i++) {
    var s = stock[i];
    if (!s.isTunnel || !s.tunnelContents || s.tunnelContents.length === 0) continue;
    var ex = getTunnelExitIdx(i);
    if (ex >= 0 && tmCellInfo[ex] !== undefined && loop.indexOf(ex) >= 0) return true;
  }
  return false;
}

function tmTracePath(loop) {
  ctx.beginPath();
  for (var k = 0; k < loop.length; k++) {
    var c = tmCellCenter(loop[k]);
    if (k === 0) ctx.moveTo(c.x, c.y); else ctx.lineTo(c.x, c.y);
  }
  ctx.closePath();
}

function tmDrawChevron(x, y, dx, dy, size) {
  // Chevron pointing along (dx, dy)
  var px = -dy, py = dx;
  ctx.beginPath();
  ctx.moveTo(x - dx * size * 0.5 + px * size * 0.7, y - dy * size * 0.5 + py * size * 0.7);
  ctx.lineTo(x + dx * size * 0.5, y + dy * size * 0.5);
  ctx.lineTo(x - dx * size * 0.5 - px * size * 0.7, y - dy * size * 0.5 - py * size * 0.7);
  ctx.stroke();
}

function drawTreadmills() {
  if (!tmLoops.length) return;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (var li = 0; li < tmLoops.length; li++) {
    var loop = tmLoops[li];
    var alive = tmLoopAlive(loop);
    ctx.globalAlpha = alive ? 1 : 0.5;

    // Belt body: thick rounded stroke through the cell centres (curved corners for free)
    tmTracePath(loop);
    ctx.strokeStyle = '#1F3A40';
    ctx.lineWidth = L.bw + L.bg * 0.6;
    ctx.stroke();
    tmTracePath(loop);
    var beat = tmBeatT * (tmIsCatchup ? 0.35 : 0.25);
    ctx.strokeStyle = tmIsCatchup && tmBeatT > 0 ? 'rgb(' + Math.round(47 + 140 * beat) + ',' + Math.round(84 + 60 * beat) + ',80)' : 'rgb(' + Math.round(47 + 80 * beat) + ',' + Math.round(84 + 80 * beat) + ',' + Math.round(92 + 80 * beat) + ')';
    ctx.lineWidth = L.bw * 0.86;
    ctx.stroke();

    // Slow flow texture: dashes travelling along the loop in its direction
    tmTracePath(loop);
    ctx.strokeStyle = 'rgba(160,220,225,0.22)';
    ctx.lineWidth = L.bw * 0.5;
    ctx.setLineDash([L.bw * 0.08, L.bw * 0.24]);
    ctx.lineDashOffset = -tmFlow * 0.25 * S;
    ctx.lineCap = 'butt';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'round';

    // Direction chevrons on the seams between cells (visible next to boxes)
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.75 + tmBeatT * 0.25) + ')';
    ctx.lineWidth = Math.max(1.5, 2.2 * S);
    for (var k = 0; k < loop.length; k++) {
      var a = tmCellCenter(loop[k]), b = tmCellCenter(loop[(k + 1) % loop.length]);
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= len; dy /= len;
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var bob = Math.sin(tmFlow * 0.08 - k * 0.6) * L.bw * 0.02;
      tmDrawChevron(mx + dx * bob, my + dy * bob, dx, dy, L.bw * 0.11);
    }

    // Level-start light running once around the loop
    if (tmIntroT > 0) {
      var prog = 1 - tmIntroT;
      var pos = prog * loop.length;
      var k0 = Math.floor(pos) % loop.length, f = pos - Math.floor(pos);
      var p0 = tmCellCenter(loop[k0]), p1 = tmCellCenter(loop[(k0 + 1) % loop.length]);
      var lx = p0.x + (p1.x - p0.x) * f, ly = p0.y + (p1.y - p0.y) * f;
      var g = ctx.createRadialGradient(lx, ly, 0, lx, ly, L.bw * 0.7);
      g.addColorStop(0, 'rgba(200,255,250,' + (0.85 * Math.min(1, tmIntroT * 3)) + ')');
      g.addColorStop(1, 'rgba(200,255,250,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(lx, ly, L.bw * 0.7, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// "Stuck" banner drawn on top of everything (last resort when no step helps)
function drawTreadmillOverlay() {
  if (!tmLoops.length) return;
  if (tmStuckT > 0) {
    ctx.save();
    ctx.globalAlpha = tmStuckT;
    var bw = 240 * S, bh = 54 * S;
    var x = W / 2 - bw / 2, y = L.sy + (L.rows * (L.bh + L.bg)) / 2 - bh / 2;
    ctx.fillStyle = 'rgba(40,30,30,0.88)';
    rRect(x, y, bw, bh, 14 * S); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + (18 * S) + 'px sans-serif';
    ctx.fillText('Stuck! No moves left', W / 2, y + bh * 0.4);
    ctx.font = (11 * S) + 'px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('The treadmills can\'t bring any box into reach', W / 2, y + bh * 0.74);
    ctx.restore();
  }
}
