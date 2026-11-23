// ============================================================
// tricolor.js — Tri-Color Customer
//   Scattered variant: each Tri-Colored Customer is a standalone
//   1x3 customer (3 vertical color strips, one marble hole each).
//   It sits anywhere in any lane, mixed with regular customers.
//   At the front of its lane it accepts one marble of each of its
//   3 colors, in any order; when all 3 are in, it completes.
// ============================================================

// ── Pick colors and build the standalone tri customers ──
// Each "set" picks 3 different colors and makes TRI_ROWS separate
// 1x3 customers with those colors (same left-to-right order). A set
// uses TRI_ROWS marbles of each color — with the default sort cap of 3
// that is exactly one regular customer per color, so the level's marble
// count stays balanced. The customers are NOT linked: placeTriCustomers
// scatters them over the lanes, mixed with regular customers.
function buildTriCustomers(sortPerColor, sets) {
  var out = [];
  var need = Math.max(1, Math.round(TRI_ROWS / SORT_CAP));
  for (var p = 0; p < sets; p++) {
    var cands = [];
    for (var c = 0; c < NUM_COLORS; c++) if (sortPerColor[c] >= need) cands.push(c);
    if (cands.length < 3) break;
    shuffle(cands);
    var colors = cands.slice(0, 3);
    for (var k = 0; k < 3; k++) sortPerColor[colors[k]] -= need;
    for (var r = 0; r < TRI_ROWS; r++) {
      out.push({ tri: true, triSet: p, colors: colors, holes: [false, false, false],
        ci: -2, filled: 0, popT: 0, vis: true, shineT: 0, squishT: 0, snapT: 0, triDone: false });
    }
  }
  return out;
}

// ── Place the tri customers into the lanes ──
// Rows are queue positions counted from the front (row 1 = front).
// Groups are placed one after another: the first group's first customer
// goes to startRow; every next group starts on the row right after the
// last (deepest) customer of the group before it. Inside a group, the
// other customers go to a random row from the group's start row to
// start + spread, in a random lane (never the same lane and row twice).
function placeTriCustomers(list, startRow, spread) {
  var taken = {};                                  // 'lane:row' → true
  var placed = [];                                 // { box, lane, row }
  var sets = [], byKey = {};
  for (var i = 0; i < list.length; i++) {
    var k = list[i].triSet;
    if (!byKey[k]) { byKey[k] = []; sets.push(byKey[k]); }
    byKey[k].push(list[i]);
  }
  var groupStart = Math.max(0, startRow - 1);      // 0-based row index
  for (var g = 0; g < sets.length; g++) {
    var members = sets[g];
    var deepest = groupStart;
    for (var m = 0; m < members.length; m++) {
      var rowHi = (m === 0) ? groupStart : groupStart + Math.max(0, spread);
      var cells = [];
      for (var r = groupStart; r <= rowHi; r++)
        for (var lane = 0; lane < 4; lane++)
          if (!taken[lane + ':' + r]) cells.push({ lane: lane, row: r });
      // Window full: take the next free row after it
      var r2 = rowHi + 1;
      while (cells.length === 0) {
        for (var lane2 = 0; lane2 < 4; lane2++)
          if (!taken[lane2 + ':' + r2]) cells.push({ lane: lane2, row: r2 });
        r2++;
      }
      var pick = cells[Math.floor(Math.random() * cells.length)];
      taken[pick.lane + ':' + pick.row] = true;
      placed.push({ box: members[m], lane: pick.lane, row: pick.row });
      if (pick.row > deepest) deepest = pick.row;
    }
    groupStart = deepest + 1;
  }
  // Insert front-to-back so earlier inserts keep their row
  placed.sort(function (a, b) { return a.row - b.row; });
  for (var p = 0; p < placed.length; p++) {
    var col = sortCols[placed[p].lane];
    col.splice(Math.min(placed[p].row, col.length), 0, placed[p].box);
  }
}

// Free hole in this row for a marble of color ci, or -1.
// Holes already targeted by a marble in flight count as taken.
function triFreeHole(row, ci, lane) {
  if (row.triDone) return -1;
  for (var k = 0; k < 3; k++) {
    if (row.colors[k] !== ci || row.holes[k]) continue;
    var taken = false;
    for (var j = 0; j < jumpers.length; j++)
      if (jumpers[j].targetCol === lane && jumpers[j].targetSlot === k) { taken = true; break; }
    if (!taken) return k;
  }
  return -1;
}

// A jumping marble reached the front box of its lane, which is a tri row.
function onTriMarbleLanded(row, j, lane) {
  var k = j.targetSlot;
  if (row.triDone || row.holes[k] || row.colors[k] !== j.ci) return;
  row.holes[k] = true; row.filled++; row.squishT = 1;
  sfx.sort();
  if (row.filled < 3) return;

  // All 3 holes full → customer complete
  row.triDone = true; row.snapT = 1; row.shineT = 1;
  tone(220, 0.12, 'square', 0.08, 120);
  setTimeout(function () { tone(160, 0.1, 'square', 0.07, 90); }, 90);
  setTimeout(function () {
    sfx.complete();
    row.popT = 1;
    var x0 = L.sSx + lane * (L.sBw + L.sColGap) + L.sBw / 2;
    var by = getSortBoxY(lane, 0) + L.sBh / 2;
    for (var k2 = 0; k2 < 3; k2++) spawnBurst(x0 + (k2 - 1) * (L.sBw / 3), by, COLORS[row.colors[k2]].fill, 8);
    spawnConfetti(x0, by, 15);
  }, 350);
  setTimeout(function () { row.vis = false; checkWin(); }, 950);
}

function updateTriAnims(box) {
  if (box.snapT > 0) box.snapT = Math.max(0, box.snapT - 0.05);
}

// ── Drawing ──
// Called from drawSortArea with the context already translated to the
// customer's center (and scaled for pop / squish). vi = position in lane.
function drawTriCell(b, vi) {
  var w = L.sBw, h = L.sBh, sw = w / 3;
  var active = (vi === 0);

  if (b.snapT > 0) {
    var wob = Math.sin(b.snapT * Math.PI * 4) * b.snapT;
    ctx.rotate(wob * 0.05);
    ctx.translate(0, -wob * 3 * S);
  }

  // Body shadow
  ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 5 * S; ctx.shadowOffsetY = 3 * S;
  ctx.fillStyle = '#000';
  rRect(-w / 2, -h / 2, w, h, 6 * S); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // Three vertical color strips, clipped to the rounded body
  ctx.save();
  rRect(-w / 2, -h / 2, w, h, 6 * S); ctx.clip();
  var holeR = Math.min(sw, h) * 0.36;
  var mrr = Math.min(6 * S * cal.sort.s * cal.marble.s, holeR * 0.95);
  for (var k = 0; k < 3; k++) {
    var sc = COLORS[b.colors[k]], x0 = -w / 2 + k * sw, cx = (k - 1) * sw;
    var g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, sc.light); g.addColorStop(0.45, sc.fill); g.addColorStop(1, sc.dark);
    ctx.fillStyle = g; ctx.fillRect(x0, -h / 2, sw + 0.5, h);
    // seam between strips
    if (k > 0) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x0, -h / 2, 1 * S, h); }
    // gloss
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    rRect(x0 + 2 * S, -h / 2 + 2 * S, sw * 0.5, h * 0.16, 2 * S); ctx.fill();
    // recessed hole
    var hg = ctx.createRadialGradient(cx, -holeR * 0.3, holeR * 0.2, cx, 0, holeR);
    hg.addColorStop(0, sc.fill); hg.addColorStop(1, sc.dark);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, 0, holeR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2 * S;
    ctx.beginPath(); ctx.arc(cx, 0, holeR, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    if (b.holes[k]) drawMarble(cx, 0, mrr, b.colors[k]);
  }
  ctx.restore();

  // Outline: live row gets a soft pulsing white edge
  if (active && !b.triDone) {
    var pul = 0.5 + Math.sin(tick * 0.12) * 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 + pul * 0.4) + ')'; ctx.lineWidth = 1.6 * S;
    rRect(-w / 2 + 0.8 * S, -h / 2 + 0.8 * S, w - 1.6 * S, h - 1.6 * S, 6 * S); ctx.stroke();
  }

  if (b.shineT > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + b.shineT * 0.4 + ')';
    rRect(-w / 2, -h / 2, w, h, 6 * S); ctx.fill();
  }

  // Customers not at the front yet are washed out
  if (!active) {
    ctx.fillStyle = 'rgba(245,235,225,0.45)';
    rRect(-w / 2, -h / 2, w, h, 6 * S); ctx.fill();
  }
}
