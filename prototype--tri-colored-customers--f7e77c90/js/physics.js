// ============================================================
// physics.js — Physics simulation, collision, marble spawning
// ============================================================

function circleLineCollide(cx2, cy2, r, x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1;
  var len2 = dx * dx + dy * dy;
  if (len2 < 0.001) return null;
  var t = ((cx2 - x1) * dx + (cy2 - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  var closestX = x1 + t * dx, closestY = y1 + t * dy;
  var distX = cx2 - closestX, distY = cy2 - closestY;
  var dist = Math.sqrt(distX * distX + distY * distY);
  if (dist < r && dist > 0.001) {
    return { nx: distX / dist, ny: distY / dist, pen: r - dist };
  }
  return null;
}

function resolveWallCollision(m, col) {
  m.x += col.nx * col.pen; m.y += col.ny * col.pen;
  var vn = m.vx * col.nx + m.vy * col.ny;
  if (vn < 0) {
    m.vx -= (1 + PHYS_BOUNCE) * vn * col.nx;
    m.vy -= (1 + PHYS_BOUNCE) * vn * col.ny;
    var tx = -col.ny, ty = col.nx;
    var vt = m.vx * tx + m.vy * ty;
    m.vx -= vt * (1 - PHYS_FRICTION) * tx;
    m.vy -= vt * (1 - PHYS_FRICTION) * ty;
  }
}

function physicsStep() {
  var subSteps = 3;
  for (var sub = 0; sub < subSteps; sub++) {
    for (var i = 0; i < physMarbles.length; i++) {
      var m = physMarbles[i];
      m.vy += PHYS_GRAVITY * S / subSteps;
      m.vx *= PHYS_DAMPING; m.vy *= PHYS_DAMPING;
      m.x += m.vx / subSteps; m.y += m.vy / subSteps;
    }
    for (var i = 0; i < physMarbles.length; i++) {
      for (var j = i + 1; j < physMarbles.length; j++) {
        var a = physMarbles[i], b = physMarbles[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var minD = a.r + b.r;
        if (dist < minD && dist > 0.01) {
          var nx = dx / dist, ny = dy / dist;
          var pen = (minD - dist) / 2;
          a.x -= nx * pen; a.y -= ny * pen;
          b.x += nx * pen; b.y += ny * pen;
          var dvx = a.vx - b.vx, dvy = a.vy - b.vy;
          var dvn = dvx * nx + dvy * ny;
          if (dvn > 0) {
            a.vx -= dvn * nx * PHYS_BOUNCE; a.vy -= dvn * ny * PHYS_BOUNCE;
            b.vx += dvn * nx * PHYS_BOUNCE; b.vy += dvn * ny * PHYS_BOUNCE;
          }
        }
      }
    }
    for (var i = 0; i < physMarbles.length; i++) {
      var m = physMarbles[i];
      for (var w = 0; w < funnelWalls.length; w++) {
        var col = circleLineCollide(m.x, m.y, m.r, funnelWalls[w].x1, funnelWalls[w].y1, funnelWalls[w].x2, funnelWalls[w].y2);
        if (col) resolveWallCollision(m, col);
      }
    }
  }

  var exitY = L.funnelBot;
  var exitL = L.funnelCx - L.funnelOpenW / 2;
  var exitR = L.funnelCx + L.funnelOpenW / 2;
  for (var i = physMarbles.length - 1; i >= 0; i--) {
    var m = physMarbles[i];
    if (m.y + m.r >= exitY - 3 * S && m.x > exitL - m.r && m.x < exitR + m.r) {
      var entryT = getBeltEntryT();
      var bestIdx = -1, bestDist = Infinity;
      for (var k = 0; k < BELT_SLOTS; k++) {
        if (beltSlots[k].marble >= 0) continue;
        var st = getSlotT(k);
        var diff = Math.abs(st - entryT);
        diff = Math.min(diff, 1 - diff);
        if (diff < bestDist) { bestDist = diff; bestIdx = k; }
      }
      if (bestIdx >= 0 && bestDist < 0.08) {
        beltSlots[bestIdx].marble = m.ci;
        beltSlots[bestIdx].arriveAnim = 0.6;
        sfx.drop();
        spawnBurst(m.x, m.y, COLORS[m.ci].fill, 6);
        physMarbles.splice(i, 1);
      }
    }
  }
}

function spawnPhysMarbles(box) {
  box.spawning = true; box.spawnIdx = 0;
  var count = box.remaining;
  var blockerCount = box.blockerCount || 0;
  var blockerStart = MRB_PER_BOX - blockerCount;
  for (var idx = 0; idx < count; idx++) {
    (function (i, b, bStart) {
      setTimeout(function () {
        if (b.remaining <= 0) return;
        var spawnIdx = MRB_PER_BOX - b.remaining;
        var si = SNAKE_ORDER[spawnIdx];
        b.remaining--;
        b.spawnIdx = MRB_PER_BOX - b.remaining;
        var MR = getMR();
        var mg = Math.min(14 * S, L.bw / 4.2);
        var mgY = mg * MRB_GAP_FACTOR;
        var mx = b.x + L.bw / 2 + (si.c - 1) * mg;
        var my = b.y + L.bh / 2 + (si.r - 1) * mgY - 2 * S;
        var vx = (Math.random() - 0.5) * 2 * S;
        var vy = -(2 + Math.random() * 2) * S;
        var marbleCi = (blockerCount > 0 && spawnIdx >= bStart) ? BLOCKER_CI : b.ci;
        physMarbles.push({ x: mx, y: my, vx: vx, vy: vy, ci: marbleCi, r: MR, spawnT: 1.0 });
        sfx.drop();
        spawnBurst(mx, my, COLORS[marbleCi].fill, 4);
        if (b.remaining <= 0) {
          b.emptyT = 1.0;
          setTimeout(function () {
            b.used = true;
            b.spawning = false;
            // Re-evaluate which boxes have an open path to the bottom
            // now that this cell is passable.
            updateBoxReveals(true);
          }, 300);
        }
      }, i * 120);
    })(idx, box, blockerStart);
  }
}
