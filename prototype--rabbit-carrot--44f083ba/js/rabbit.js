// ============================================================
// rabbit.js — Rabbit & Carrot (prototype)
//
// The Rabbit sits on one sorting customer (a column + a place in its
// queue) and blocks it: the customer keeps its marbles and colour but
// takes no new ones. Every box the player opens hops it to the next
// column's front customer, back and forth (columns with no customers
// left are skipped; if the target front customer is just leaving, the
// Rabbit waits for the next one).
//
// Carrots rest on Carrot boxes. Opening one sends the Carrot flying to
// the Rabbit, which jumps and catches it, then retreats to the 4th
// customer of its column (counting the front as the 1st) holding the
// Carrot. Back there it ignores taps and rides forward with its
// customer; at the front it drops the Carrot and carries on. It never
// holds more than one Carrot. The last Carrot sends it off the level;
// so does its column being the only one with customers left.
//
// Level setting: rabbitLane (0-3, -1 = no Rabbit).
// ============================================================

var RABBIT_RETREAT_ROWS = 3;      // 3 = the 4th customer
var RABBIT_HOP_FRAMES = 15;       // 0.25 s at 60 fps
var RABBIT_HOP_HEIGHT = 0.9;      // in customer heights
var RABBIT_FLIGHT_FRAMES = 21;    // Carrot flight, 0.35 s
var RABBIT_CATCH_HEIGHT = 1.4;    // catch jump, in customer heights
var RABBIT_EXIT_FRAMES = 36;      // 0.6 s
var RABBIT_VANISH_FRAMES = 12;    // dropped Carrot shrink, 0.2 s
var RABBIT_FOLLOW = 0.3;          // easing toward its customer when the queue moves

var rabbit = null;
var boardCarrots = [];   // { box } — Carrots still on their boxes
var flyingCarrots = [];  // { x, y, fx, fy, tx, ty, t, spin }
var vanishCarrots = [];  // { x, y, t, rot }

// ── Queue helpers ──
function rabbitVisible(c) {
  var out = [];
  var col = sortCols[c];
  for (var r = 0; r < col.length; r++) if (col[r].vis) out.push(col[r]);
  return out;
}

function rabbitFront(c) {
  var vis = rabbitVisible(c);
  return vis.length > 0 ? vis[0] : null;
}

function rabbitLaneAvailable(c) {
  return rabbitVisible(c).length > 0;
}

function rabbitLandable(box) {
  return box && box.vis && box.type !== 'lock' && box.filled < SORT_CAP;
}

function rabbitOtherLaneAvailable(c) {
  for (var o = 0; o < sortCols.length; o++) if (o !== c && rabbitLaneAvailable(o)) return true;
  return false;
}

// Next column with customers, keeping the direction and turning at the end.
function rabbitNextLane(from) {
  for (var pass = 0; pass < 2; pass++) {
    for (var c = from + rabbit.dir; c >= 0 && c < sortCols.length; c += rabbit.dir) {
      if (rabbitLaneAvailable(c)) return c;
    }
    rabbit.dir = -rabbit.dir;
  }
  return -1;
}

// Is this sorting customer held by the Rabbit? (called by the belt → sort matching)
function rabbitHoldsCustomer(box) {
  return rabbit && rabbit.active && rabbit.box === box;
}

// ── Seat positions ──
function rabbitSeat() {
  var c = rabbit.col;
  var vis = rabbitVisible(c);
  var vi = vis.indexOf(rabbit.box);
  if (vi < 0) vi = 0;
  return { x: L.sSx + c * (L.sBw + L.sColGap) + L.sBw / 2, y: getSortBoxY(c, vi) + L.sBh * 0.42 };
}

// ── Init (called at the end of initGame) ──
function rabbitInit(lvl) {
  rabbit = null; boardCarrots = []; flyingCarrots = []; vanishCarrots = [];
  if (!lvl || lvl.rabbitLane === undefined || lvl.rabbitLane < 0) return;
  for (var i = 0; i < stock.length; i++) {
    var b = stock[i];
    if (!b.empty && !b.isTunnel && !b.isWall && b.boxType === 'carrot') boardCarrots.push({ box: b });
  }
  var lane = Math.max(0, Math.min(sortCols.length - 1, lvl.rabbitLane));
  rabbit = { active: true, col: lane, box: rabbitFront(lane), pending: -1, dir: -1,
    retreating: false, holding: false, x: 0, y: 0, hopT: 0, hopFromX: 0, hopFromY: 0,
    catching: false, catchFromY: 0, catchToY: 0, keepCarrot: false, leaveAfterCatch: false,
    leaving: false, exitT: 0, exitFromX: 0, exitFromY: 0, placed: false };
  if (!rabbitLandable(rabbit.box)) { rabbit.box = null; rabbit.pending = lane; }
  rabbitCheckLastLane();
}

// ── Tap hook (called by handleTap after a box opens) ──
function rabbitOnBoxOpened(b) {
  if (!rabbit || !rabbit.active) return;
  for (var i = 0; i < boardCarrots.length; i++) {
    if (boardCarrots[i].box === b) { rabbitCatchCarrot(i); return; }
  }
  if (rabbit.retreating) return;
  rabbitMoveToNextLane(rabbit.pending >= 0 ? rabbit.pending : rabbit.col);
}

function rabbitMoveToNextLane(from) {
  var t = rabbitNextLane(from);
  if (t < 0) { rabbitLeave(); return; }
  var f = rabbitFront(t);
  if (rabbitLandable(f)) {
    rabbit.pending = -1; rabbit.col = t; rabbitSitOn(f, true);
    rabbitCheckLastLane();
  } else {
    rabbit.pending = t;   // its customer is leaving: wait for the next one
  }
}

function rabbitSitOn(box, hop) {
  rabbit.box = box;
  if (hop && rabbit.placed && !rabbit.catching) {
    rabbit.hopT = 1; rabbit.hopFromX = rabbit.x; rabbit.hopFromY = rabbit.y;
  }
}

function rabbitCatchCarrot(i) {
  var carrot = boardCarrots.splice(i, 1)[0];
  var last = boardCarrots.length === 0;
  if (last) { rabbitLeave(carrot); return; }

  // Back to the 4th customer of this column (or its last one); further back already: stay.
  var vis = rabbitVisible(rabbit.col);
  var vi = Math.max(0, vis.indexOf(rabbit.box));
  var target = Math.max(vi, Math.min(RABBIT_RETREAT_ROWS, vis.length - 1));
  rabbit.pending = -1;
  rabbit.box = vis.length > 0 ? vis[target] : null;
  rabbit.retreating = target > 0;
  rabbitStartCatch([carrot], rabbit.retreating, false);
}

// Carrots fly to a point above the Rabbit; the Rabbit jumps to meet them.
function rabbitStartCatch(carrots, keep, leaveAfter) {
  rabbit.catching = true; rabbit.keepCarrot = keep; rabbit.leaveAfterCatch = leaveAfter;
  rabbit.hopT = 0;
  rabbit.catchFromY = rabbit.y;
  rabbit.catchToY = rabbit.y - L.sBh * RABBIT_CATCH_HEIGHT;
  for (var k = 0; k < carrots.length; k++) {
    var b = carrots[k].box;
    var fx = b.x + L.bw * 0.62, fy = b.y + L.bh * 0.38;
    flyingCarrots.push({ x: fx, y: fy, fx: fx, fy: fy, tx: rabbit.x, ty: rabbit.catchToY, t: 0, spin: 0 });
  }
  sfx.pop();
}

function rabbitDropCarrot() {
  if (!rabbit || !rabbit.holding) return;
  rabbit.holding = false;
  vanishCarrots.push({ x: rabbit.x + L.sBw * 0.2, y: rabbit.y + L.sBh * 0.05, t: 1, rot: -0.35 });
}

// Leave the level: every Carrot still on the board flies to it too.
function rabbitLeave(opened) {
  var all = [];
  if (opened) all.push(opened);
  for (var i = 0; i < boardCarrots.length; i++) all.push(boardCarrots[i]);
  boardCarrots = [];
  rabbit.active = false; rabbit.pending = -1; rabbit.retreating = false; rabbit.box = null;
  if (all.length > 0) rabbitStartCatch(all, true, true);
  else rabbitStartExit();
}

function rabbitStartExit() {
  rabbit.leaving = true; rabbit.exitT = 0; rabbit.exitFromX = rabbit.x; rabbit.exitFromY = rabbit.y;
  sfx.complete();
}

function rabbitCheckLastLane() {
  if (!rabbit || !rabbit.active || rabbit.pending >= 0) return;
  if (!rabbitOtherLaneAvailable(rabbit.col)) rabbitLeave();
}

// ── Per-frame update (called from update()) ──
function rabbitUpdate() {
  if (!rabbit) return;

  if (rabbit.active) {
    // Its customer completed (from marbles already flying): sit on whoever is at the front now.
    if (rabbit.box && !rabbit.box.vis) {
      rabbit.box = null;
      if (rabbitLaneAvailable(rabbit.col)) rabbit.pending = rabbit.col;
      else { rabbit.retreating = false; rabbitDropCarrot(); rabbitMoveToNextLane(rabbit.col); }
    }
    // Waiting for a front customer to arrive.
    if (rabbit.active && rabbit.pending >= 0) {
      if (!rabbitLaneAvailable(rabbit.pending)) { var p = rabbit.pending; rabbit.pending = -1; rabbitMoveToNextLane(p); }
      else {
        var f = rabbitFront(rabbit.pending);
        if (rabbitLandable(f)) { rabbit.col = rabbit.pending; rabbit.pending = -1; rabbitSitOn(f, true); }
      }
    }
    // Back at the front after a retreat: drop the Carrot, back and forth again.
    if (rabbit.active && rabbit.retreating && rabbit.box && rabbitVisible(rabbit.col).indexOf(rabbit.box) === 0) {
      rabbit.retreating = false;
      rabbitDropCarrot();
    }
    if (rabbit.active) rabbitCheckLastLane();
  }

  // Animations
  if (rabbit.catching) {
    var minT = 1;
    for (var i = 0; i < flyingCarrots.length; i++) {
      var fc = flyingCarrots[i];
      fc.t = Math.min(1, fc.t + 1 / RABBIT_FLIGHT_FRAMES);
      fc.spin += 0.35;
      var arc = Math.sin(fc.t * Math.PI) * L.sBh * 1.2;
      fc.x = fc.fx + (fc.tx - fc.fx) * fc.t;
      fc.y = fc.fy + (fc.ty - fc.fy) * fc.t - arc;
      minT = Math.min(minT, fc.t);
    }
    var jump = Math.max(0, (minT - 0.45) / 0.55);
    var eased = 1 - (1 - jump) * (1 - jump);
    rabbit.y = rabbit.catchFromY + (rabbit.catchToY - rabbit.catchFromY) * eased;
    if (minT >= 1) {
      // Caught: keep the first (it replaces the held one), the rest shrink away.
      if (rabbit.keepCarrot) rabbitDropCarrot();
      for (var k = 0; k < flyingCarrots.length; k++) {
        if (k === 0 && rabbit.keepCarrot) { rabbit.holding = true; continue; }
        vanishCarrots.push({ x: flyingCarrots[k].x, y: flyingCarrots[k].y, t: 1, rot: flyingCarrots[k].spin });
      }
      flyingCarrots = [];
      rabbit.catching = false;
      spawnBurst(rabbit.x, rabbit.y, '#FF8A1F', 10);
      sfx.sort();
      if (rabbit.leaveAfterCatch) rabbitStartExit();
      else if (rabbit.box) { rabbit.hopT = 1; rabbit.hopFromX = rabbit.x; rabbit.hopFromY = rabbit.y; }
    }
  } else if (rabbit.leaving) {
    rabbit.exitT = Math.min(1, rabbit.exitT + 1 / RABBIT_EXIT_FRAMES);
    rabbit.x = rabbit.exitFromX + (-W * 0.25 - rabbit.exitFromX) * rabbit.exitT;
    rabbit.y = rabbit.exitFromY - Math.sin(rabbit.exitT * Math.PI) * L.sBh * 2;
    if (rabbit.exitT >= 1) rabbit = null;
  } else if (rabbit.box) {
    var seat = rabbitSeat();
    if (!rabbit.placed) { rabbit.x = seat.x; rabbit.y = seat.y; rabbit.placed = true; }
    else if (rabbit.hopT > 0) {
      rabbit.hopT = Math.max(0, rabbit.hopT - 1 / RABBIT_HOP_FRAMES);
      var t = 1 - rabbit.hopT;
      rabbit.x = rabbit.hopFromX + (seat.x - rabbit.hopFromX) * t;
      rabbit.y = rabbit.hopFromY + (seat.y - rabbit.hopFromY) * t - Math.sin(t * Math.PI) * L.sBh * RABBIT_HOP_HEIGHT;
      if (rabbit.hopT === 0) sfx.sort();
    } else {
      rabbit.x += (seat.x - rabbit.x) * RABBIT_FOLLOW;
      rabbit.y += (seat.y - rabbit.y) * RABBIT_FOLLOW;
    }
  }

  for (var v = vanishCarrots.length - 1; v >= 0; v--) {
    vanishCarrots[v].t -= 1 / RABBIT_VANISH_FRAMES;
    if (vanishCarrots[v].t <= 0) vanishCarrots.splice(v, 1);
  }
}

// ── Drawing ──
function drawCarrotShape(x, y, size, rot, scale) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale);
  // leaves
  ctx.fillStyle = '#3FB54A';
  for (var i = -1; i <= 1; i++) {
    ctx.save(); ctx.rotate(i * 0.45);
    ctx.beginPath(); ctx.ellipse(0, -size * 0.62, size * 0.09, size * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // root
  var g = ctx.createLinearGradient(-size * 0.2, 0, size * 0.2, 0);
  g.addColorStop(0, '#FFA347'); g.addColorStop(1, '#E8700F');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-size * 0.2, -size * 0.42);
  ctx.quadraticCurveTo(0, -size * 0.52, size * 0.2, -size * 0.42);
  ctx.lineTo(0, size * 0.5);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(160,70,0,0.5)'; ctx.lineWidth = 1.2 * S;
  for (var s = 0; s < 3; s++) {
    var yy = -size * 0.2 + s * size * 0.2, hw = size * (0.14 - s * 0.035);
    ctx.beginPath(); ctx.moveTo(-hw, yy); ctx.lineTo(-hw * 0.2, yy + size * 0.03); ctx.stroke();
  }
  ctx.restore();
}

function drawRabbitShape(x, y) {
  var u = L.sBw * 0.36;   // body half-width
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 5 * S; ctx.shadowOffsetY = 2 * S;
  ctx.fillStyle = '#FAF7F0';
  // ears (may overlap the belt a little)
  for (var e = -1; e <= 1; e += 2) {
    ctx.beginPath(); ctx.ellipse(e * u * 0.32, -u * 1.55, u * 0.2, u * 0.55, e * 0.12, 0, Math.PI * 2); ctx.fill();
  }
  // body and head
  ctx.beginPath(); ctx.ellipse(0, u * 0.2, u * 0.85, u * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -u * 0.62, u * 0.55, u * 0.48, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // inner ears
  ctx.fillStyle = '#FFA0B8';
  for (var e2 = -1; e2 <= 1; e2 += 2) {
    ctx.beginPath(); ctx.ellipse(e2 * u * 0.32, -u * 1.52, u * 0.09, u * 0.4, e2 * 0.12, 0, Math.PI * 2); ctx.fill();
  }
  // tail
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(u * 0.8, u * 0.45, u * 0.22, 0, Math.PI * 2); ctx.fill();
  // face
  ctx.fillStyle = '#2A2020';
  ctx.beginPath(); ctx.arc(-u * 0.2, -u * 0.68, u * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(u * 0.2, -u * 0.68, u * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FF7FA0';
  ctx.beginPath(); ctx.ellipse(0, -u * 0.5, u * 0.08, u * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Called from frame() after drawSortArea().
function drawRabbitLayer() {
  var carrotSize = L.bw * 0.55;
  for (var i = 0; i < boardCarrots.length; i++) {
    var b = boardCarrots[i].box;
    drawCarrotShape(b.x + L.bw * 0.62, b.y + L.bh * 0.38, carrotSize, -0.6, 1);
  }
  for (var v = 0; v < vanishCarrots.length; v++) {
    var vc = vanishCarrots[v];
    drawCarrotShape(vc.x, vc.y, carrotSize, vc.rot, Math.max(0, vc.t));
  }
  if (rabbit && (rabbit.box || rabbit.catching || rabbit.leaving || rabbit.pending >= 0)) {
    if (!rabbit.placed && rabbit.box) { var seat = rabbitSeat(); rabbit.x = seat.x; rabbit.y = seat.y; rabbit.placed = true; }
    if (rabbit.placed) {
      drawRabbitShape(rabbit.x, rabbit.y);
      if (rabbit.holding) drawCarrotShape(rabbit.x + L.sBw * 0.24, rabbit.y + L.sBh * 0.05, carrotSize * 0.85, -0.35, 1);
    }
  }
  for (var f = 0; f < flyingCarrots.length; f++) {
    var fc = flyingCarrots[f];
    drawCarrotShape(fc.x, fc.y, carrotSize, fc.spin, 1);
  }
}
