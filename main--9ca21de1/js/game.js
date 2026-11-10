// ============================================================
// game.js — Game init, update loop, input, level select
//           + Tunnel spawning integration
//           + Wall cell support
// ============================================================

// === LEVEL SELECT ===
function showLevelSelect() {
  gameActive = false;
  document.getElementById('win-screen').classList.remove('show');
  document.getElementById('cal-toggle').style.display = 'none';
  if (typeof editor !== 'undefined' && editor._testIdx !== undefined) {
    editorCleanupTest();
    showEditor(false);
    return;
  }
  document.getElementById('level-screen').classList.remove('hidden');
  if (typeof editorCleanupTest === 'function') editorCleanupTest();
}

function startLevel(idx) {
  currentLevel = idx;
  gameActive = true;
  document.getElementById('level-screen').classList.add('hidden');
  document.getElementById('cal-toggle').style.display = '';
  ensureAudio();
  initGame();
}

// === GAME INIT ===
function initGame() {
  won = false; score = 0; particles = []; physMarbles = []; jumpers = []; tick = 0; hoverIdx = -1;
  totalBlockerMarbles = 0; blockersOnBelt = 0; blockerCollecting = false; blockerCollectT = 0;
  blockerCollectSlots = []; blockerCollectCleared = false;
  document.getElementById('win-screen').classList.remove('show');
  computeLayout(); initBeltSlots();

  var totalSlots = L.rows * L.cols;
  var lvl = LEVELS[currentLevel];

  // ── Build boxSlots, tunnelSlots, wallSlots from grid or legacy random ──
  var boxSlots = {};
  var tunnelSlots = {};
  var wallSlots = {};
  if (lvl.grid) {
    for (var i = 0; i < Math.min(lvl.grid.length, totalSlots); i++) {
      var cell = lvl.grid[i];
      if (cell === null || cell === undefined) continue;
      if (cell.wall) {
        wallSlots[i] = true;
        continue;
      }
      if (cell.tunnel) {
        tunnelSlots[i] = { dir: cell.dir || 'bottom', contents: cell.contents ? cell.contents.slice() : [] };
      } else if (typeof cell === 'number') {
        if (cell >= 0) boxSlots[i] = { ci: cell, boxType: 'default' };
      } else if (typeof cell === 'object' && cell.ci >= 0) {
        boxSlots[i] = { ci: cell.ci, boxType: cell.type || 'default' };
      }
    }
  }
  if (lvl.mrbPerBox) MRB_PER_BOX = lvl.mrbPerBox;
  if (lvl.sortCap) SORT_CAP = lvl.sortCap;

  // ── Count regular marbles per color for sort columns ──
  var colorMarblesTotal = [];
  for (var c = 0; c < NUM_COLORS; c++) colorMarblesTotal.push(0);
  for (var k in boxSlots) {
    var bs = boxSlots[k];
    var isBlockerBox = (bs.boxType === 'blocker');
    var regularPerBox = isBlockerBox ? (MRB_PER_BOX - BLOCKER_PER_BOX) : MRB_PER_BOX;
    colorMarblesTotal[bs.ci] += regularPerBox;
    if (isBlockerBox) totalBlockerMarbles += BLOCKER_PER_BOX;
  }
  // Count marbles from tunnel contents
  for (var k in tunnelSlots) {
    var ts = tunnelSlots[k];
    for (var tc = 0; tc < ts.contents.length; tc++) {
      var tItem = ts.contents[tc];
      var isBlockerBox = (tItem.type === 'blocker');
      var regularPerBox = isBlockerBox ? (MRB_PER_BOX - BLOCKER_PER_BOX) : MRB_PER_BOX;
      colorMarblesTotal[tItem.ci] += regularPerBox;
      if (isBlockerBox) totalBlockerMarbles += BLOCKER_PER_BOX;
    }
  }
  var sortPerColor = [];
  for (var c = 0; c < NUM_COLORS; c++) {
    sortPerColor.push(SORT_CAP > 0 ? Math.ceil(colorMarblesTotal[c] / SORT_CAP) : 0);
  }

  // ── Build stock ──
  stock = [];
  for (var r = 0; r < L.rows; r++) for (var c = 0; c < L.cols; c++) {
    var idx = r * L.cols + c;
    var slot = boxSlots[idx];
    var tSlot = tunnelSlots[idx];
    var wSlot = wallSlots[idx];

    if (tSlot) {
      // Tunnel entry
      stock.push({
        isTunnel: true, isWall: false,
        tunnelDir: tSlot.dir,
        tunnelContents: tSlot.contents.map(function (item) { return { ci: item.ci, type: item.type || 'default' }; }),
        tunnelTotal: tSlot.contents.length,
        tunnelSpawning: false,
        tunnelCooldown: 60,
        ci: 0, used: false, remaining: 0, spawning: false, spawnIdx: 0,
        revealed: true, empty: false, boxType: 'default',
        iceHP: 0, iceCrackT: 0, iceShatterT: 0, blockerCount: 0,
        x: L.sx + c * (L.bw + L.bg), y: L.sy + r * (L.bh + L.bg),
        shakeT: 0, hoverT: 0, popT: 0, revealT: 0, emptyT: 0, idlePhase: 0
      });
    } else if (wSlot) {
      // Wall cell — inert structural element
      stock.push({
        isWall: true, isTunnel: false,
        ci: 0, used: false, remaining: 0, spawning: false, spawnIdx: 0,
        revealed: false, empty: false, boxType: 'default',
        iceHP: 0, iceCrackT: 0, iceShatterT: 0, blockerCount: 0,
        x: L.sx + c * (L.bw + L.bg), y: L.sy + r * (L.bh + L.bg),
        shakeT: 0, hoverT: 0, popT: 0, revealT: 0, emptyT: 0, idlePhase: 0
      });
    } else if (!slot) {
      stock.push({ ci: 0, used: false, remaining: 0, spawning: false, spawnIdx: 0,
        revealed: true, empty: true, boxType: 'default', isTunnel: false, isWall: false,
        iceHP: 0, iceCrackT: 0, iceShatterT: 0, blockerCount: 0,
        x: L.sx + c * (L.bw + L.bg), y: L.sy + r * (L.bh + L.bg),
        shakeT: 0, hoverT: 0, popT: 0, revealT: 0, emptyT: 0, idlePhase: 0 });
    } else {
      var isIce = (slot.boxType === 'ice');
      var isBlocker = (slot.boxType === 'blocker');
      stock.push({ ci: slot.ci, used: false, remaining: MRB_PER_BOX, spawning: false, spawnIdx: 0,
        revealed: isIce ? true : false, empty: false,
        boxType: slot.boxType || 'default', isTunnel: false, isWall: false,
        iceHP: isIce ? 2 : 0,
        iceCrackT: 0, iceShatterT: 0,
        blockerCount: isBlocker ? BLOCKER_PER_BOX : 0,
        x: L.sx + c * (L.bw + L.bg), y: L.sy + r * (L.bh + L.bg),
        shakeT: 0, hoverT: 0, popT: 0, revealT: 0, emptyT: 0,
        idlePhase: Math.random() * Math.PI * 2 });
    }
  }

  // ── Reveal boxes that currently have an open path to the bottom ──
  updateBoxReveals(false);

  // ── Sort columns ──
  var allBoxes = [];
  for (var c = 0; c < NUM_COLORS; c++) for (var r = 0; r < sortPerColor[c]; r++)
    allBoxes.push({ ci: c, filled: 0, popT: 0, vis: true, shineT: 0, squishT: 0 });
  shuffle(allBoxes);
  sortCols = [[], [], [], []];
  for (var i = 0; i < allBoxes.length; i++) sortCols[i % 4].push(allBoxes[i]);

  // Lock buttons
  var numLocks = lvl.lockButtons || 0;
  for (var li2 = 0; li2 < numLocks; li2++) {
    var lockCol = Math.floor(Math.random() * 4);
    var lockRow = Math.min(2 + Math.floor(Math.random() * 4), sortCols[lockCol].length);
    sortCols[lockCol].splice(lockRow, 0, { type: 'lock', ci: -1, filled: 0, popT: 0, vis: true, shineT: 0, squishT: 0, triggerT: 0, triggered: false });
  }
}

// === REVEAL — PATH TO BOTTOM ===
// A box is "open" (revealed and interactable) only when there is a
// chain of passable grid cells from its position to below the bottom
// edge of the grid. Passable cells are:
//   • empty slots
//   • used-up boxes
// Walls, active (non-used) boxes, and tunnels (even depleted ones)
// all block the path. If the path closes, the box closes itself.
function updateBoxReveals(animate) {
  if (!stock || stock.length === 0) return;
  if (!L || !L.rows || !L.cols) return;
  var total = stock.length;

  // 1. Mark which cells are passable.
  var passable = new Array(total);
  for (var i = 0; i < total; i++) {
    var s = stock[i];
    if (!s) { passable[i] = false; continue; }
    if (s.isWall) { passable[i] = false; continue; }
    if (s.isTunnel) { passable[i] = false; continue; }
    passable[i] = !!(s.empty || s.used);
  }

  // 2. Flood-fill from the bottom row. Passable cells in the bottom
  //    row sit directly on the grid's lower edge, so they connect to
  //    "below the grid" which is the path's destination.
  var reachable = new Array(total);
  for (var j = 0; j < total; j++) reachable[j] = false;
  var queue = [];
  var bottomRow = L.rows - 1;
  for (var bc = 0; bc < L.cols; bc++) {
    var bIdx = bottomRow * L.cols + bc;
    if (passable[bIdx]) { reachable[bIdx] = true; queue.push(bIdx); }
  }
  var head = 0;
  while (head < queue.length) {
    var cur = queue[head++];
    var cr = Math.floor(cur / L.cols), cc = cur % L.cols;
    var nbrs = [];
    if (cr > 0)            nbrs.push((cr - 1) * L.cols + cc);
    if (cr < L.rows - 1)   nbrs.push((cr + 1) * L.cols + cc);
    if (cc > 0)            nbrs.push(cr * L.cols + (cc - 1));
    if (cc < L.cols - 1)   nbrs.push(cr * L.cols + (cc + 1));
    for (var n = 0; n < nbrs.length; n++) {
      var ni = nbrs[n];
      if (!reachable[ni] && passable[ni]) {
        reachable[ni] = true;
        queue.push(ni);
      }
    }
  }

  // 3. For each active box, open it iff a passable neighbor reaches
  //    the bottom (or the box is itself in the bottom row, sitting
  //    on the lower edge). Close boxes whose path is now blocked.
  for (var k = 0; k < total; k++) {
    var b = stock[k];
    if (!b) continue;
    if (b.isWall || b.isTunnel || b.empty || b.used) continue;
    if (b.spawning) continue;

    var br = Math.floor(k / L.cols), bcol = k % L.cols;
    var hasPath = false;
    if (br === L.rows - 1) {
      hasPath = true;
    } else {
      var bnbrs = [];
      if (br > 0)          bnbrs.push((br - 1) * L.cols + bcol);
      if (br < L.rows - 1) bnbrs.push((br + 1) * L.cols + bcol);
      if (bcol > 0)        bnbrs.push(br * L.cols + (bcol - 1));
      if (bcol < L.cols - 1) bnbrs.push(br * L.cols + (bcol + 1));
      for (var m = 0; m < bnbrs.length; m++) {
        if (reachable[bnbrs[m]]) { hasPath = true; break; }
      }
    }

    if (hasPath && !b.revealed) {
      b.revealed = true;
      if (animate) {
        b.revealT = 1.0;
        var bx = b.x + L.bw / 2, by = b.y + L.bh / 2;
        var burstColor = (b.boxType === 'hidden') ? '#FFD700' : COLORS[b.ci].fill;
        for (var p = 0; p < 12; p++) {
          var ang = Math.PI * 2 * p / 12 + Math.random() * 0.3;
          var sp = 3 + Math.random() * 4;
          particles.push({
            x: bx, y: by,
            vx: Math.cos(ang) * sp * S, vy: Math.sin(ang) * sp * S,
            r: (2 + Math.random() * 4) * S, color: burstColor,
            life: 1, decay: 0.02 + Math.random() * 0.015, grav: false
          });
        }
        if (typeof sfx !== 'undefined' && sfx.pop) sfx.pop();
      }
    } else if (!hasPath && b.revealed) {
      b.revealed = false;
      b.revealT = 0;
    }
  }
}

// === ICE DAMAGE ===
function damageAdjacentIce(idx) {
  var row = Math.floor(idx / L.cols), col = idx % L.cols;
  var neighbors = [];
  if (row > 0)          neighbors.push((row - 1) * L.cols + col);
  if (row < L.rows - 1) neighbors.push((row + 1) * L.cols + col);
  if (col > 0)          neighbors.push(row * L.cols + (col - 1));
  if (col < L.cols - 1) neighbors.push(row * L.cols + (col + 1));
  for (var ni = 0; ni < neighbors.length; ni++) {
    var nb = stock[neighbors[ni]];
    if (nb.isTunnel || nb.isWall) continue;  // tunnels and walls don't have ice
    if (nb.empty || nb.used || nb.iceHP <= 0) continue;

    nb.iceHP--;
    var bx = nb.x + L.bw / 2, by = nb.y + L.bh / 2;

    if (nb.iceHP === 1) {
      nb.iceCrackT = 1.0;
      nb.shakeT = 0.4;
      sfx.pop();
      for (var p = 0; p < 10; p++) {
        var a = Math.PI * 2 * p / 10 + Math.random() * 0.4, sp = 2 + Math.random() * 3;
        particles.push({ x: bx, y: by, vx: Math.cos(a) * sp * S, vy: Math.sin(a) * sp * S,
          r: (1.5 + Math.random() * 3) * S, color: 'rgba(180,225,255,0.8)',
          life: 0.8, decay: 0.03 + Math.random() * 0.02, grav: false });
      }
    } else if (nb.iceHP === 0) {
      nb.iceShatterT = 1.0;
      nb.popT = 0.8;
      nb.boxType = 'default';
      sfx.complete();
      for (var p = 0; p < 20; p++) {
        var a = Math.PI * 2 * p / 20 + Math.random() * 0.3, sp = 3 + Math.random() * 5;
        particles.push({ x: bx, y: by, vx: Math.cos(a) * sp * S, vy: Math.sin(a) * sp * S - 2 * S,
          r: (2 + Math.random() * 4) * S,
          color: Math.random() > 0.5 ? 'rgba(180,225,255,0.9)' : 'rgba(220,240,255,0.9)',
          life: 1, decay: 0.015 + Math.random() * 0.015, grav: true });
      }
      for (var p = 0; p < 8; p++) {
        var a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
        particles.push({ x: bx, y: by, vx: Math.cos(a) * sp * S, vy: Math.sin(a) * sp * S,
          r: (3 + Math.random() * 3) * S, color: 'rgba(255,255,255,0.7)',
          life: 0.6, decay: 0.04, grav: false });
      }
    }
  }
}

function isBoxTappable(idx) {
  var b = stock[idx];
  if (b.isTunnel) return false;
  if (b.isWall) return false;      // walls are not tappable
  if (b.empty || b.used) return false;
  if (b.spawning || b.revealT > 0) return false;
  if (b.iceHP > 0) return false;
  return b.revealed;
}

function getSortBoxY(ci, vi) { return L.sTop + vi * (L.sBh + L.sGap); }

// === INPUT ===
function handleTap(px, py) {
  if (won || !gameActive) return;
  ensureAudio();
  if (px >= L.bkX && px <= L.bkX + L.bkSize && py >= L.bkY && py <= L.bkY + L.bkSize) { showLevelSelect(); return; }
  for (var i = 0; i < stock.length; i++) {
    var b = stock[i];
    if (b.isTunnel || b.isWall) continue;  // skip tunnels and walls in tap handler
    if (b.empty || b.used || b.spawning || b.revealT > 0) continue;
    if (px >= b.x && px <= b.x + L.bw && py >= b.y && py <= b.y + L.bh) {
      if (!isBoxTappable(i)) { b.shakeT = 0.5; return; }
      b.popT = 1;
      sfx.pop();
      spawnBurst(b.x + L.bw / 2, b.y + L.bh / 2, COLORS[b.ci].fill, 18);
      spawnPhysMarbles(b);
      damageAdjacentIce(i);
      return;
    }
  }
}
canvas.addEventListener('click', function (e) { handleTap(e.clientX, e.clientY); });
canvas.addEventListener('touchstart', function (e) { e.preventDefault(); handleTap(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
document.getElementById('cal-panel').addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: false });
canvas.addEventListener('mousemove', function (e) {
  hoverIdx = -1;
  if (!gameActive) return;
  if (e.clientX >= L.bkX && e.clientX <= L.bkX + L.bkSize && e.clientY >= L.bkY && e.clientY <= L.bkY + L.bkSize) { canvas.style.cursor = 'pointer'; return; }
  for (var i = 0; i < stock.length; i++) {
    var b = stock[i];
    if (b.isTunnel || b.isWall) continue;
    if (b.empty || b.used || b.spawning || b.revealT > 0) continue;
    if (!isBoxTappable(i)) continue;
    if (e.clientX >= b.x && e.clientX <= b.x + L.bw && e.clientY >= b.y && e.clientY <= b.y + L.bh) { hoverIdx = i; break; }
  }
  canvas.style.cursor = hoverIdx >= 0 ? 'pointer' : 'default';
});

// === UPDATE ===
function update() {
  if (!gameActive) return;
  tick++;
  physicsStep();

  beltOffset = (beltOffset + BELT_SPEED * S) % 1;
  for (var i = 0; i < BELT_SLOTS; i++) {
    if (beltSlots[i].arriveAnim > 0) beltSlots[i].arriveAnim = Math.max(0, beltSlots[i].arriveAnim - 0.025);
  }

  // ── Tunnel spawning ──
  trySpawnFromTunnels();

  // Belt → sort matching
  for (var si = 0; si < BELT_SLOTS; si++) {
    var slot = beltSlots[si]; if (slot.marble < 0) continue;
    var slotT = getSlotT(si);
    for (var c = 0; c < 4; c++) {
      var col = sortCols[c]; var tv = -1;
      for (var r = 0; r < col.length; r++) { if (col[r].vis) { tv = r; break; } }
      if (tv < 0 || col[tv].ci !== slot.marble) continue;
      var inFlight = 0;
      for (var j = 0; j < jumpers.length; j++) if (jumpers[j].targetCol === c) inFlight++;
      if (col[tv].filled + inFlight >= SORT_CAP) continue;
      var bt = L.sortBeltT[c]; var diff = Math.abs(slotT - bt); var wdiff = Math.min(diff, 1 - diff);
      if (wdiff < 0.015) {
        var aj = false;
        for (var j = 0; j < jumpers.length; j++) if (jumpers[j].slotIdx === si) { aj = true; break; }
        if (aj) continue;
        var pos = getSlotPos(si);
        jumpers.push({ ci: slot.marble, slotIdx: si, startX: pos.x, startY: pos.y, targetCol: c, targetSlot: col[tv].filled + inFlight, t: 0 });
        slot.marble = -1; break;
      }
    }
  }

  // Jumper animation
  for (var i = jumpers.length - 1; i >= 0; i--) {
    var j = jumpers[i]; j.t += 0.04;
    if (j.t >= 1) {
      var col = sortCols[j.targetCol]; var tv = -1;
      for (var r = 0; r < col.length; r++) { if (col[r].vis) { tv = r; break; } }
      if (tv >= 0 && col[tv].ci === j.ci) {
        col[tv].filled++;
        col[tv].squishT = 1;
        sfx.sort();
        if (col[tv].filled >= SORT_CAP) {
          col[tv].popT = 1; col[tv].shineT = 1;
          sfx.complete();
          var bx2 = L.sSx + j.targetCol * (L.sBw + L.sColGap) + L.sBw / 2;
          var by2 = getSortBoxY(j.targetCol, 0) + L.sBh / 2;
          spawnBurst(bx2, by2, COLORS[j.ci].fill, 20);
          spawnConfetti(bx2, by2, 15);
          (function (box) { setTimeout(function () { box.vis = false; checkWin(); }, 600); })(col[tv]);
        }
      }
      jumpers.splice(i, 1);
    }
  }

  // Blocker collection
  if (!blockerCollecting && totalBlockerMarbles > 0) {
    blockersOnBelt = 0;
    blockerCollectSlots = [];
    for (var i = 0; i < BELT_SLOTS; i++) {
      if (beltSlots[i].marble === BLOCKER_CI) { blockersOnBelt++; blockerCollectSlots.push(i); }
    }
    if (blockersOnBelt >= totalBlockerMarbles) {
      blockerCollecting = true; blockerCollectT = 1; blockerCollectCleared = false;
    }
  }
  if (blockerCollecting) {
    blockerCollectT = Math.max(0, blockerCollectT - 0.015);
    if (blockerCollectT <= 0.5 && !blockerCollectCleared) {
      blockerCollectCleared = true;
      for (var k = 0; k < blockerCollectSlots.length; k++) {
        var csi = blockerCollectSlots[k];
        if (beltSlots[csi].marble === BLOCKER_CI) {
          var cpos = getSlotPos(csi);
          beltSlots[csi].marble = -1;
          spawnBurst(cpos.x, cpos.y, COLORS[BLOCKER_CI].light, 10);
          for (var p = 0; p < 3; p++) {
            var a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
            particles.push({ x: cpos.x, y: cpos.y,
              vx: (L.beltCx - cpos.x) * 0.03 + Math.cos(a) * sp * S,
              vy: ((L.beltTopY + L.beltBotY) / 2 - cpos.y) * 0.03 + Math.sin(a) * sp * S,
              r: (2 + Math.random() * 3) * S, color: '#fff', life: 0.8, decay: 0.03, grav: false });
          }
        }
      }
      var bcx = L.beltCx, bcy = (L.beltTopY + L.beltBotY) / 2;
      spawnBurst(bcx, bcy, '#A89E94', 20);
      spawnConfetti(bcx, bcy, 25);
      sfx.win();
      blockersOnBelt = 0;
    }
    if (blockerCollectT <= 0) {
      blockerCollecting = false;
      blockerCollectT = 0;
      blockerCollectSlots = [];
    }
  }

  // Stock animations
  for (var i = 0; i < stock.length; i++) {
    var b = stock[i];
    if (b.isTunnel || b.isWall) continue;  // tunnels and walls don't need stock animations
    if (b.empty) continue;
    if (b.shakeT > 0) b.shakeT = Math.max(0, b.shakeT - 0.04);
    if (b.popT > 0) b.popT = Math.max(0, b.popT - 0.025);
    if (b.revealT > 0) b.revealT = Math.max(0, b.revealT - 0.03);
    if (b.emptyT > 0) b.emptyT = Math.max(0, b.emptyT - 0.025);
    if (b.iceCrackT > 0) b.iceCrackT = Math.max(0, b.iceCrackT - 0.03);
    if (b.iceShatterT > 0) b.iceShatterT = Math.max(0, b.iceShatterT - 0.025);
    var th = (i === hoverIdx && !b.used && isBoxTappable(i)) ? 1 : 0;
    b.hoverT += (th - b.hoverT) * 0.12;
  }

  // Phys marble spawn bounce
  for (var i = 0; i < physMarbles.length; i++) {
    if (physMarbles[i].spawnT > 0) physMarbles[i].spawnT = Math.max(0, physMarbles[i].spawnT - 0.05);
  }

  // Sort box animations
  for (var c = 0; c < sortCols.length; c++) {
    var col = sortCols[c];
    for (var r = 0; r < col.length; r++) {
      if (col[r].popT > 0) col[r].popT = Math.max(0, col[r].popT - 0.018);
      if (col[r].shineT > 0) col[r].shineT = Math.max(0, col[r].shineT - 0.025);
      if (col[r].squishT > 0) col[r].squishT = Math.max(0, col[r].squishT - 0.06);
    }
  }

  // Lock button trigger
  for (var c = 0; c < sortCols.length; c++) {
    var col = sortCols[c]; var topVis = -1;
    for (var r = 0; r < col.length; r++) if (col[r].vis) { topVis = r; break; }
    if (topVis < 0) continue;
    var box = col[topVis];
    if (box.type === 'lock' && !box.triggered) {
      box.triggered = true; box.triggerT = 1.0; box.shineT = 1;
      sfx.complete();
      var bx = L.sSx + c * (L.sBw + L.sColGap) + L.sBw / 2;
      var by = getSortBoxY(c, 0) + L.sBh / 2;
      spawnBurst(bx, by, '#FFD700', 20); spawnConfetti(bx, by, 15);
      (function (boxRef) {
        setTimeout(function () { boxRef.popT = 1; }, 300);
        setTimeout(function () { boxRef.vis = false; checkWin(); }, 700);
      })(box);
    }
    if (box.type === 'lock' && box.triggerT > 0) box.triggerT = Math.max(0, box.triggerT - 0.03);
  }

  tickParticles();
  updateRollingSound();
}

function checkWin() {
  for (var c = 0; c < sortCols.length; c++)
    for (var r = 0; r < sortCols[c].length; r++)
      if (sortCols[c][r].vis) return;
  for (var i = 0; i < stock.length; i++) {
    if (stock[i].isTunnel && stock[i].tunnelContents && stock[i].tunnelContents.length > 0) return;
  }
  if (!won) {
    won = true; sfx.win();
    document.getElementById('win-msg').textContent = 'All marbles sorted perfectly!';
    spawnConfetti(W / 2, H / 3, 60);
    setTimeout(function () { spawnConfetti(W * 0.3, H / 2, 40); }, 200);
    setTimeout(function () { spawnConfetti(W * 0.7, H / 2, 40); }, 400);
    setTimeout(function () { spawnConfetti(W / 2, H / 4, 50); }, 600);
    setTimeout(function () { spawnConfetti(W / 2, H / 2, 80); }, 800);
    setTimeout(function () { document.getElementById('win-screen').classList.add('show'); }, 2000);
  }
}

// === MAIN LOOP ===
function frame() {
  if (gameActive) {
    update();
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawFunnel();
    drawStock();
    drawPhysMarbles();
    drawBelt();
    drawBlockerProgress();
    drawJumpers();
    drawSortArea();
    drawBackButton();
    drawParticles();
    drawDebugWalls();
  }
  requestAnimationFrame(frame);
}

// === PROTOTYPE.JSON LOADER ===
var prototypeInfo = null;  // loaded from prototype.json if present

function loadPrototypeJSON(callback) {
  fetch('prototype.json').then(function(r) {
    if (!r.ok) throw new Error('not found');
    return r.json();
  }).then(function(data) {
    prototypeInfo = data;
    if (data.showcaseLevel && data.showcaseLevel.grid) {
      LEVELS.push(data.showcaseLevel);
      levelStars.push(0);
      unlockedLevels = LEVELS.length;
    }
    callback();
  }).catch(function() {
    callback();
  });
}

function playShowcase() {
  if (!prototypeInfo || !prototypeInfo.showcaseLevel) return;
  var idx = LEVELS.length - 1; // showcase level is always last added
  startLevel(idx);
}

function updateShowcaseUI() {
  var btn = document.getElementById('ls-showcase-btn');
  var info = document.getElementById('ls-showcase-info');
  if (!prototypeInfo || !prototypeInfo.showcaseLevel) {
    if (btn) btn.style.display = 'none';
    if (info) info.style.display = 'none';
    return;
  }
  if (btn) btn.style.display = '';
  if (info) {
    info.style.display = '';
    var html = '';
    if (prototypeInfo.name) html += '<div class="ls-showcase-name">' + prototypeInfo.name + '</div>';
    if (prototypeInfo.description) html += '<div class="ls-showcase-desc">' + prototypeInfo.description + '</div>';
    if (prototypeInfo.howToPlay) html += '<div class="ls-showcase-how"><strong>How to play:</strong> ' + prototypeInfo.howToPlay + '</div>';
    info.innerHTML = html;
  }
}

// === BOOT ===
resize();
loadPrototypeJSON(function() {
  updateShowcaseUI();
  showLevelSelect();
});
frame();
