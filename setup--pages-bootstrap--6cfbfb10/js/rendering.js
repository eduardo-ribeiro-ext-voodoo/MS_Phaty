// ============================================================
// rendering.js — Core drawing functions
// ============================================================
// drawStock delegates closed/reveal states to BoxTypes registry.
// Open (tappable) state is the same for all box types.
// Ice overlay is drawn on top of revealed boxes with iceHP > 0.
// Tunnel entries are drawn via drawTunnelOnGrid.
// Wall cells are drawn via drawWallOnGrid.
// ============================================================

function rRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function drawMarble(x, y, r, ci, es) {
  var rs = r * (es || 1);
  var c = COLORS[ci];
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = rs * 0.6; ctx.shadowOffsetY = rs * 0.15;
  var grad = ctx.createRadialGradient(x - rs * 0.25, y - rs * 0.25, rs * 0.1, x, y, rs);
  grad.addColorStop(0, c.light); grad.addColorStop(0.7, c.fill); grad.addColorStop(1, c.dark);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(x, y, rs, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.arc(x - rs * 0.25, y - rs * 0.25, rs * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBackground() {
  ctx.fillStyle = '#EDE5D8';
  ctx.fillRect(0, 0, W, H);
}

// ── Shared drawing helpers used by box types ──

function drawBox(x, y, w, h, ci, alpha) {
  var c = COLORS[ci];
  ctx.save();
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 5 * S; ctx.shadowOffsetY = 2 * S;
  var grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, c.light); grad.addColorStop(1, c.dark);
  ctx.fillStyle = grad;
  rRect(x, y, w, h, 6 * S); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = c.dark; ctx.lineWidth = 1.5 * S;
  rRect(x, y, w, h, 6 * S); ctx.stroke();
  ctx.restore();
}

function drawEmptySlot(x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(180,165,145,0.3)';
  rRect(x, y, w, h, 6 * S); ctx.fill();
  ctx.strokeStyle = 'rgba(160,140,120,0.25)'; ctx.lineWidth = 1 * S;
  ctx.setLineDash([3 * S, 3 * S]);
  rRect(x, y, w, h, 6 * S); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawBoxMarbles(ci, remaining) {
  if (remaining <= 0) return;
  var mr = Math.min(7 * S, L.bw / 8.5);
  var mg = Math.min(14 * S, L.bw / 4.2);
  var mgY = mg * MRB_GAP_FACTOR;
  var gone = MRB_PER_BOX - remaining;
  var mrbsToDraw = [];
  for (var si = gone; si < MRB_PER_BOX; si++) mrbsToDraw.push(SNAKE_ORDER[si]);
  mrbsToDraw.sort(function (a, b) { return a.r - b.r; });
  for (var si = 0; si < mrbsToDraw.length; si++) {
    var sp = mrbsToDraw[si];
    drawMarble((sp.c - 1) * mg, (sp.r - 1) * mgY - 2 * S, mr, ci);
  }
}

function drawBoxMarblesWithBlockers(ci, remaining, blockerCount) {
  if (remaining <= 0) return;
  var mr = Math.min(7 * S, L.bw / 8.5);
  var mg = Math.min(14 * S, L.bw / 4.2);
  var mgY = mg * MRB_GAP_FACTOR;
  var gone = MRB_PER_BOX - remaining;
  var blockerStart = MRB_PER_BOX - blockerCount;
  var mrbsToDraw = [];
  for (var si = gone; si < MRB_PER_BOX; si++) {
    mrbsToDraw.push({ r: SNAKE_ORDER[si].r, c: SNAKE_ORDER[si].c, isBlocker: si >= blockerStart });
  }
  mrbsToDraw.sort(function (a, b) { return a.r - b.r; });
  for (var si = 0; si < mrbsToDraw.length; si++) {
    var sp = mrbsToDraw[si];
    var mci = sp.isBlocker ? BLOCKER_CI : ci;
    drawMarble((sp.c - 1) * mg, (sp.r - 1) * mgY - 2 * S, mr, mci);
  }
}

function drawBoxLip(ci) {
  ctx.save();
  var lipH = L.bh * LIP_PCT;
  ctx.beginPath(); ctx.rect(-L.bw / 2, L.bh / 2 - lipH, L.bw, lipH); ctx.clip();
  drawBox(-L.bw / 2, -L.bh / 2, L.bw, L.bh, ci);
  ctx.restore();
}

// ── Funnel (always visible) ──

function drawFunnel() {
  var exitL = L.funnelCx - L.funnelOpenW / 2;
  var exitR = L.funnelCx + L.funnelOpenW / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(L.funnelLeft, L.funnelTop);
  ctx.lineTo(L.funnelLeft, L.funnelBendY);
  ctx.lineTo(exitL, L.funnelBot);
  ctx.lineTo(exitR, L.funnelBot);
  ctx.lineTo(L.funnelRight, L.funnelBendY);
  ctx.lineTo(L.funnelRight, L.funnelTop);
  ctx.closePath();
  ctx.fillStyle = 'rgba(180,165,145,0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,120,95,0.5)';
  ctx.lineWidth = 2.5 * S;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(L.funnelLeft, L.funnelTop);
  ctx.lineTo(L.funnelLeft, L.funnelBendY);
  ctx.lineTo(exitL, L.funnelBot);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(L.funnelRight, L.funnelTop);
  ctx.lineTo(L.funnelRight, L.funnelBendY);
  ctx.lineTo(exitR, L.funnelBot);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(140,120,95,0.35)';
  ctx.lineWidth = 2 * S;
  ctx.beginPath();
  ctx.moveTo(0, L.funnelBot);
  ctx.lineTo(exitL, L.funnelBot);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(exitR, L.funnelBot);
  ctx.lineTo(W, L.funnelBot);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1 * S;
  ctx.beginPath();
  ctx.moveTo(L.funnelLeft + 2 * S, L.funnelTop);
  ctx.lineTo(L.funnelLeft + 2 * S, L.funnelBendY);
  ctx.lineTo(exitL + 2 * S, L.funnelBot - 2 * S);
  ctx.stroke();
  ctx.restore();
}

// ── Stock grid — delegates to registered box types, handles tunnels + walls ──

function drawStock() {
  for (var i = 0; i < stock.length; i++) {
    var b = stock[i];

    // ── Tunnel ──
    if (b.isTunnel) {
      var tRemain = b.tunnelContents ? b.tunnelContents.length : 0;
      drawTunnelOnGrid(ctx, b.x, b.y, L.bw, L.bh, S,
        b.tunnelDir, tRemain, b.tunnelTotal, tick, b.tunnelSpawning);
      continue;
    }

    // ── Wall ──
    if (b.isWall) {
      drawWallOnGrid(ctx, b.x, b.y, L.bw, L.bh, S, tick);
      continue;
    }

    var ox = 0;
    if (b.shakeT > 0) ox = Math.sin(b.shakeT * 28) * 5 * S * b.shakeT;
    var breathe = 0;
    if (!b.used && !b.spawning && b.revealT <= 0 && b.revealed && isBoxTappable(i)) {
      breathe = Math.sin(tick * 0.04 + b.idlePhase) * 0.02;
    }
    var ps = 1 + b.popT * 0.15 + breathe;
    var hs = 1 + b.hoverT * 0.05;
    var ts = ps * hs;

    // Empty slot
    if (b.empty) { drawEmptySlot(b.x, b.y, L.bw, L.bh); continue; }

    // Used box fading out
    if (b.used && b.emptyT > 0) {
      ts *= 0.7 + 0.3 * (1 - b.emptyT);
      ctx.save(); ctx.globalAlpha = 1 - b.emptyT * 0.3;
      ctx.translate(b.x + L.bw / 2 + ox, b.y + L.bh / 2); ctx.scale(ts, ts);
      drawEmptySlot(-L.bw / 2, -L.bh / 2, L.bw, L.bh);
      ctx.restore(); continue;
    }

    // Used box (fully empty)
    if (b.used) { drawEmptySlot(b.x, b.y, L.bw, L.bh); continue; }

    var bt = getBoxType(b.boxType);
    ctx.save();
    ctx.translate(b.x + L.bw / 2 + ox, b.y + L.bh / 2); ctx.scale(ts, ts);

    if (b.revealT > 0) {
      var phase = 1 - b.revealT;
      bt.drawReveal(ctx, -L.bw / 2, -L.bh / 2, L.bw, L.bh, b.ci, S, phase, b.remaining, tick);
    } else if (!b.revealed) {
      var idleWobble = Math.sin(tick * 0.02 + b.idlePhase) * 0.006;
      ctx.rotate(idleWobble);
      bt.drawClosed(ctx, -L.bw / 2, -L.bh / 2, L.bw, L.bh, b.ci, S, tick, b.idlePhase);
    } else {
      var c = COLORS[b.ci];
      if (isBoxTappable(i) && b.hoverT > 0.01) { ctx.shadowColor = c.glow; ctx.shadowBlur = 20 * S * b.hoverT; }
      drawBox(-L.bw / 2, -L.bh / 2, L.bw, L.bh, b.ci);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      if (b.boxType === 'blocker' && b.blockerCount > 0) {
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.beginPath(); rRect(-L.bw / 2, -L.bh / 2, L.bw, L.bh, 6 * S); ctx.clip();
        ctx.strokeStyle = COLORS[BLOCKER_CI].fill; ctx.lineWidth = 2 * S;
        var sg = 8 * S;
        for (var d = -L.bw; d < L.bw + L.bh; d += sg) {
          ctx.beginPath(); ctx.moveTo(-L.bw / 2 + d, -L.bh / 2); ctx.lineTo(-L.bw / 2 + d - L.bh, L.bh / 2); ctx.stroke();
        }
        ctx.restore();
      }
      if (b.remaining > 0) {
        if (b.boxType === 'blocker' && b.blockerCount > 0) {
          drawBoxMarblesWithBlockers(b.ci, b.remaining, b.blockerCount);
        } else {
          drawBoxMarbles(b.ci, b.remaining);
        }
        drawBoxLip(b.ci);
      }
    }

    if (b.iceHP > 0) {
      var iceType = getBoxType('ice');
      if (iceType && iceType.drawIceOverlay) {
        iceType.drawIceOverlay(ctx, -L.bw / 2, -L.bh / 2, L.bw, L.bh, S, b.iceHP, tick);
      }
    }

    if (b.iceShatterT > 0) {
      ctx.save();
      ctx.globalAlpha = b.iceShatterT * 0.4;
      ctx.fillStyle = 'rgba(200,235,255,1)';
      rRect(-L.bw / 2, -L.bh / 2, L.bw, L.bh, 6 * S); ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}

// ── Physics marbles ──

function drawPhysMarbles() {
  for (var i = 0; i < physMarbles.length; i++) {
    var m = physMarbles[i];
    var bounce = m.spawnT > 0 ? (1 + Math.sin(m.spawnT * Math.PI) * 0.4) : 1;
    drawMarble(m.x, m.y, m.r, m.ci, bounce);
  }
}

// ── Belt ──

function drawBelt() {
  var slotR = 8 * S;
  for (var i = 0; i < BELT_SLOTS; i++) {
    var pos = getSlotPos(i); var slot = beltSlots[i];
    ctx.save();
    ctx.fillStyle = 'rgba(180,165,145,0.35)';
    ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 3 * S; ctx.shadowOffsetY = 1 * S;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, slotR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(160,140,120,0.25)'; ctx.lineWidth = 1 * S;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, slotR, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (slot.marble >= 0) {
      var bs = 1;
      if (slot.arriveAnim > 0) { var t2 = 1 - slot.arriveAnim; bs = 1 + Math.sin(t2 * Math.PI * 3) * 0.3 * slot.arriveAnim; }
      if (slot.marble === BLOCKER_CI && blockerCollecting && blockerCollectT > 0.5) {
        var ct = (blockerCollectT - 0.5) * 2;
        var pulse = 1 + Math.sin((1 - ct) * Math.PI * 8) * 0.2;
        bs *= pulse;
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin((1 - ct) * Math.PI * 6) * 0.25;
        ctx.fillStyle = COLORS[BLOCKER_CI].glow;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, slotR * 1.6 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      drawMarble(pos.x, pos.y, slotR * 0.8 * cal.marble.s, slot.marble, bs);
    }
  }
}

// ── Blocker progress indicator ──

function drawBlockerProgress() {
  if (totalBlockerMarbles <= 0) return;
  var cx = L.beltCx;
  var cy = (L.beltBotY + L.sTop) / 2;
  var total = totalBlockerMarbles;
  var filled = blockersOnBelt;
  var dotR = 3.5 * S;
  var gap = dotR * 3;
  var startX = cx - (total - 1) * gap / 2;
  var pillW = Math.max((total - 1) * gap + dotR * 5, dotR * 6);
  var pillH = dotR * 3.2;
  ctx.save();
  ctx.fillStyle = 'rgba(122,112,104,0.10)';
  rRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, pillH / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(122,112,104,0.18)'; ctx.lineWidth = 1 * S;
  rRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, pillH / 2); ctx.stroke();
  var iconX = cx - pillW / 2 - dotR * 2.5;
  var bc = COLORS[BLOCKER_CI];
  ctx.globalAlpha = 0.4;
  var icGrd = ctx.createRadialGradient(iconX, cy, 0, iconX, cy, dotR * 1.1);
  icGrd.addColorStop(0, bc.light); icGrd.addColorStop(1, bc.dark);
  ctx.fillStyle = icGrd;
  ctx.beginPath(); ctx.arc(iconX, cy, dotR * 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  for (var i = 0; i < total; i++) {
    var dx = startX + i * gap;
    if (i < filled) {
      var grd = ctx.createRadialGradient(dx - dotR * 0.15, cy - dotR * 0.15, dotR * 0.1, dx, cy, dotR);
      grd.addColorStop(0, bc.light); grd.addColorStop(0.7, bc.fill); grd.addColorStop(1, bc.dark);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(dx, cy, dotR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(dx - dotR * 0.2, cy - dotR * 0.2, dotR * 0.35, 0, Math.PI * 2); ctx.fill();
      if (blockerCollecting && blockerCollectT > 0.5) {
        ctx.globalAlpha = 0.4 + Math.sin(tick * 0.2 + i * 0.5) * 0.3;
        ctx.fillStyle = bc.glow;
        ctx.beginPath(); ctx.arc(dx, cy, dotR * 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.strokeStyle = 'rgba(122,112,104,0.22)'; ctx.lineWidth = 1 * S;
      ctx.setLineDash([2 * S, 2 * S]);
      ctx.beginPath(); ctx.arc(dx, cy, dotR * 0.65, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (blockerCollecting && blockerCollectT <= 0.5 && blockerCollectT > 0) {
    var flashAlpha = blockerCollectT * 2;
    ctx.globalAlpha = flashAlpha * 0.6;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    rRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, pillH / 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ── Jumpers ──

function drawJumpers() {
  var slotR = 8 * S;
  for (var i = 0; i < jumpers.length; i++) {
    var j = jumpers[i]; var t = j.t;
    var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    var tx = L.sSx + j.targetCol * (L.sBw + L.sColGap) + L.sBw / 2 + (j.targetSlot - 1) * (L.sBw / 4);
    var ty = getSortBoxY(j.targetCol, 0) + L.sBh / 2;
    var x = j.startX + (tx - j.startX) * e;
    var y = j.startY + (ty - j.startY) * e - Math.sin(t * Math.PI) * 50 * S;
    var arcScale = 1 + Math.sin(t * Math.PI) * 0.25;
    if (tick % 3 === 0) {
      particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 0.5 * S, vy: 0.5 * S,
        r: (2 + Math.random() * 2) * S, color: COLORS[j.ci].light, life: 0.6, decay: 0.04, grav: false });
    }
    drawMarble(x, y, slotR * 0.8 * cal.marble.s, j.ci, arcScale);
  }
}

// ── Sort area ──

function drawSortArea() {
  for (var c = 0; c < 4; c++) {
    var col = sortCols[c]; var x = L.sSx + c * (L.sBw + L.sColGap);
    var visibleBoxes = [];
    for (var r = 0; r < col.length; r++) if (col[r].vis) visibleBoxes.push(col[r]);
    var showCount = Math.min(visibleBoxes.length, SORT_VISIBLE_ROWS);
    var hiddenCount = visibleBoxes.length - showCount;
    for (var vi = 0; vi < showCount; vi++) {
      var b = visibleBoxes[vi]; var byy = getSortBoxY(c, vi);
      var ps = 1 + b.popT * 0.25; var al = b.popT > 0.6 ? (1 - b.popT) * 2.5 : 1;
      var sqX = 1, sqY = 1;
      if (b.squishT > 0) { var sq = Math.sin(b.squishT * Math.PI); sqX = 1 + sq * 0.12; sqY = 1 - sq * 0.08; }
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, al));
      ctx.translate(x + L.sBw / 2, byy + L.sBh / 2); ctx.scale(ps * sqX, ps * sqY);

      if (b.type === 'lock') {
        var isTop = (vi === 0);
        var pulse = isTop ? 1 + Math.sin(tick * 0.08) * 0.03 : 1;
        ctx.scale(pulse, pulse);
        ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 5 * S; ctx.shadowOffsetY = 3 * S;
        var grad = ctx.createLinearGradient(0, -L.sBh / 2, 0, L.sBh / 2);
        if (b.triggered) { grad.addColorStop(0, '#7BC67B'); grad.addColorStop(1, '#4AA04A'); }
        else if (isTop) { grad.addColorStop(0, '#FFD966'); grad.addColorStop(1, '#E8A84C'); }
        else { grad.addColorStop(0, '#B8A898'); grad.addColorStop(1, '#9A8A78'); }
        ctx.fillStyle = grad;
        rRect(-L.sBw / 2, -L.sBh / 2, L.sBw, L.sBh, 8 * S); ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        if (b.shineT > 0) { ctx.fillStyle = 'rgba(255,255,255,' + b.shineT * 0.5 + ')'; rRect(-L.sBw / 2, -L.sBh / 2, L.sBw, L.sBh, 8 * S); ctx.fill(); }
        var iconS = Math.min(L.sBh * 0.35, L.sBw * 0.15);
        if (!b.triggered) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          rRect(-iconS * 0.6, -iconS * 0.2, iconS * 1.2, iconS * 0.9, 2 * S); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2 * S; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(0, -iconS * 0.2, iconS * 0.4, -Math.PI, 0); ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3 * S; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(-iconS * 0.5, 0); ctx.lineTo(-iconS * 0.1, iconS * 0.4); ctx.lineTo(iconS * 0.5, -iconS * 0.3); ctx.stroke();
        }
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 5 * S; ctx.shadowOffsetY = 3 * S;
        var sc = COLORS[b.ci];
        var sGrad = ctx.createLinearGradient(-L.sBw / 2, -L.sBh / 2, -L.sBw / 2, L.sBh / 2);
        sGrad.addColorStop(0, sc.light); sGrad.addColorStop(1, sc.fill);
        ctx.fillStyle = sGrad;
        rRect(-L.sBw / 2, -L.sBh / 2, L.sBw, L.sBh, 8 * S); ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.strokeStyle = sc.dark; ctx.lineWidth = 1 * S;
        rRect(-L.sBw / 2, -L.sBh / 2, L.sBw, L.sBh, 8 * S); ctx.stroke();
        if (b.shineT > 0) { ctx.fillStyle = 'rgba(255,255,255,' + b.shineT * 0.35 + ')'; rRect(-L.sBw / 2, -L.sBh / 2, L.sBw, L.sBh, 8 * S); ctx.fill(); }
        var sp = L.sBw / 4, mrr = 6 * S * cal.sort.s * cal.marble.s;
        for (var j2 = 0; j2 < b.filled; j2++) drawMarble((j2 - 1) * sp, 0, mrr, b.ci);
        for (var j2 = b.filled; j2 < SORT_CAP; j2++) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc((j2 - 1) * sp, 0, mrr * 0.55, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }
    if (hiddenCount > 0) {
      ctx.fillStyle = 'rgba(120,100,80,0.5)'; ctx.font = 9 * S + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+' + hiddenCount + ' more', x + L.sBw / 2, L.sTop + showCount * (L.sBh + L.sGap) + 6 * S);
    }
    if (visibleBoxes.length > 0) {
      var topBox = visibleBoxes[0];
      ctx.fillStyle = topBox.type === 'lock' ? 'rgba(200,180,100,0.6)' : 'rgba(120,100,80,0.3)';
      ctx.font = 'bold ' + (8 * S) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var label = topBox.type === 'lock' ? '\uD83D\uDD13' : visibleBoxes.length.toString();
      ctx.fillText(label, x + L.sBw / 2, L.sTop - 8 * S);
    }
  }
}

// ── Back button ──

function drawBackButton() {
  ctx.save();
  ctx.fillStyle = 'rgba(160,130,100,0.7)';
  ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 4 * S; ctx.shadowOffsetY = 2 * S;
  rRect(L.bkX, L.bkY, L.bkSize, L.bkSize, 8 * S); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = 'white'; ctx.font = 'bold ' + (L.bkSize * 0.5) + 'px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('\u2190', L.bkX + L.bkSize / 2, L.bkY + L.bkSize / 2);
  ctx.restore();
}

// ── Debug walls ──

function drawDebugWalls() {
  // invisible — physics walls for marble collisions
}
