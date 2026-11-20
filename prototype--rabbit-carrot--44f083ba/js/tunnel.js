// ============================================================
// tunnel.js — Tunnel mechanic: stores hidden boxes, spawns
//             them one at a time when the exit tile is free.
// ============================================================

var TUNNEL_DIR_ARROWS = { top: '\u25B2', left: '\u25C0', bottom: '\u25BC', right: '\u25B6' };
var TUNNEL_SPAWN_COOLDOWN = 40; // ticks between spawns

// ── Drawing ──

function drawTunnelOnGrid(ctx, x, y, w, h, S, dir, remaining, total, tick, spawning) {
  ctx.save();

  // Dark portal base
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 5 * S;
  ctx.shadowOffsetY = 2 * S;
  var grad = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  grad.addColorStop(0, '#3D3548');
  grad.addColorStop(0.5, '#2E2838');
  grad.addColorStop(1, '#252030');
  ctx.fillStyle = grad;
  rRect(x, y, w, h, 6 * S);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Animated border glow when active
  var active = remaining > 0;
  var glowPulse = active ? (Math.sin(tick * 0.06) * 0.15 + 0.55) : 0.3;
  ctx.strokeStyle = active
    ? 'rgba(255,190,80,' + glowPulse + ')'
    : 'rgba(100,90,80,0.4)';
  ctx.lineWidth = 2 * S;
  rRect(x, y, w, h, 6 * S);
  ctx.stroke();

  // Inner dark tunnel opening
  var inset = w * 0.18;
  var innerGrad = ctx.createRadialGradient(
    x + w / 2, y + h / 2, w * 0.05,
    x + w / 2, y + h / 2, w * 0.4
  );
  innerGrad.addColorStop(0, 'rgba(0,0,0,0.5)');
  innerGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = innerGrad;
  rRect(x + inset, y + inset, w - inset * 2, h - inset * 2, 4 * S);
  ctx.fill();

  // Direction arrow
  var cx = x + w / 2, cy = y + h / 2;
  var arrowSize = w * 0.2;
  var arrowAlpha = active ? 0.8 : 0.35;

  // Offset arrow toward exit direction
  var aox = 0, aoy = 0, oShift = w * 0.08;
  if (dir === 'top') aoy = -oShift;
  else if (dir === 'bottom') aoy = oShift;
  else if (dir === 'left') aox = -oShift;
  else aox = oShift;

  ctx.fillStyle = active ? 'rgba(255,210,100,' + arrowAlpha + ')' : 'rgba(180,170,160,' + arrowAlpha + ')';
  ctx.beginPath();
  if (dir === 'top') {
    ctx.moveTo(cx + aox, cy + aoy - arrowSize);
    ctx.lineTo(cx + aox - arrowSize * 0.65, cy + aoy + arrowSize * 0.35);
    ctx.lineTo(cx + aox + arrowSize * 0.65, cy + aoy + arrowSize * 0.35);
  } else if (dir === 'bottom') {
    ctx.moveTo(cx + aox, cy + aoy + arrowSize);
    ctx.lineTo(cx + aox - arrowSize * 0.65, cy + aoy - arrowSize * 0.35);
    ctx.lineTo(cx + aox + arrowSize * 0.65, cy + aoy - arrowSize * 0.35);
  } else if (dir === 'left') {
    ctx.moveTo(cx + aox - arrowSize, cy + aoy);
    ctx.lineTo(cx + aox + arrowSize * 0.35, cy + aoy - arrowSize * 0.65);
    ctx.lineTo(cx + aox + arrowSize * 0.35, cy + aoy + arrowSize * 0.65);
  } else {
    ctx.moveTo(cx + aox + arrowSize, cy + aoy);
    ctx.lineTo(cx + aox - arrowSize * 0.35, cy + aoy - arrowSize * 0.65);
    ctx.lineTo(cx + aox - arrowSize * 0.35, cy + aoy + arrowSize * 0.65);
  }
  ctx.closePath();
  ctx.fill();

  // Count badge (top-right)
  var badgeR = Math.min(w, h) * 0.19;
  var bx = x + w - badgeR * 0.8;
  var by = y + badgeR * 0.8;

  if (remaining > 0) {
    ctx.fillStyle = 'rgba(255,180,60,0.92)';
    ctx.beginPath(); ctx.arc(bx, by, badgeR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(200,140,30,0.6)';
    ctx.lineWidth = 1 * S;
    ctx.beginPath(); ctx.arc(bx, by, badgeR, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + (badgeR * 1.3) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(remaining, bx, by + 0.5);
  } else {
    // Empty badge
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = 'rgba(120,110,100,0.5)';
    ctx.beginPath(); ctx.arc(bx, by, badgeR * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#999';
    ctx.font = 'bold ' + (badgeR * 1.1) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('0', bx, by + 0.5);
    ctx.globalAlpha = 1;
  }

  // Spawn animation glow
  if (spawning) {
    ctx.globalAlpha = 0.25 + Math.sin(tick * 0.3) * 0.15;
    ctx.fillStyle = 'rgba(255,220,120,0.4)';
    rRect(x, y, w, h, 6 * S);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Subtle idle pulse when active
  if (active && !spawning) {
    var pulse = Math.sin(tick * 0.04) * 0.04 + 0.06;
    ctx.fillStyle = 'rgba(255,200,100,' + pulse + ')';
    rRect(x, y, w, h, 6 * S);
    ctx.fill();
  }

  ctx.restore();
}

// ── Exit tile computation ──

function getTunnelExitIdx(tunnelIdx) {
  var row = Math.floor(tunnelIdx / L.cols);
  var col = tunnelIdx % L.cols;
  var dir = stock[tunnelIdx].tunnelDir;
  var er = row, ec = col;
  if (dir === 'top') er = row - 1;
  else if (dir === 'bottom') er = row + 1;
  else if (dir === 'left') ec = col - 1;
  else if (dir === 'right') ec = col + 1;
  if (er < 0 || er >= L.rows || ec < 0 || ec >= L.cols) return -1;
  return er * L.cols + ec;
}

function isTileAvailableForTunnel(idx) {
  if (idx < 0 || idx >= stock.length) return false;
  var s = stock[idx];
  // Must be an empty slot or a fully-used box (not a tunnel, not an active box, not a wall)
  if (s.isTunnel) return false;
  if (s.isWall) return false;  // walls block tunnel spawning
  return s.empty || s.used;
}

// ── Spawning logic (called from update) ──

function trySpawnFromTunnels() {
  for (var i = 0; i < stock.length; i++) {
    var s = stock[i];
    if (!s.isTunnel) continue;
    if (s.tunnelContents.length === 0) continue;
    if (s.tunnelSpawning) continue;
    if (s.tunnelCooldown > 0) { s.tunnelCooldown--; continue; }

    var exitIdx = getTunnelExitIdx(i);
    if (exitIdx < 0) continue;
    if (!isTileAvailableForTunnel(exitIdx)) continue;

    // Spawn the next box from the tunnel
    var nextBox = s.tunnelContents.shift();
    s.tunnelSpawning = true;
    s.tunnelCooldown = TUNNEL_SPAWN_COOLDOWN;

    var exitRow = Math.floor(exitIdx / L.cols);
    var exitCol = exitIdx % L.cols;
    var isIce = (nextBox.type === 'ice');
    var isBlocker = (nextBox.type === 'blocker');

    stock[exitIdx] = {
      ci: nextBox.ci,
      used: false,
      remaining: MRB_PER_BOX,
      spawning: false,
      spawnIdx: 0,
      // Start closed; updateBoxReveals will open it if the exit cell
      // still has a passable path to the bottom of the grid.
      revealed: false,
      empty: false,
      boxType: nextBox.type || 'default',
      iceHP: isIce ? 2 : 0,
      iceCrackT: 0,
      iceShatterT: 0,
      blockerCount: isBlocker ? BLOCKER_PER_BOX : 0,
      isTunnel: false,
      isWall: false,
      x: L.sx + exitCol * (L.bw + L.bg),
      y: L.sy + exitRow * (L.bh + L.bg),
      shakeT: 0,
      hoverT: 0,
      popT: 0.8,
      revealT: 0,
      emptyT: 0,
      idlePhase: Math.random() * Math.PI * 2
    };

    // Particles from tunnel toward exit tile
    var tx = s.x + L.bw / 2, ty = s.y + L.bh / 2;
    var ex = stock[exitIdx].x + L.bw / 2, ey = stock[exitIdx].y + L.bh / 2;
    spawnBurst(tx, ty, '#FFD080', 8);
    spawnBurst(ex, ey, '#FFD080', 10);
    sfx.pop();

    // Re-evaluate reveals: the new box may itself be open (path below),
    // and any boxes that relied on the now-occupied exit cell as their
    // path to the bottom must close.
    if (typeof updateBoxReveals === 'function') updateBoxReveals(true);

    // End spawning animation after a short delay
    (function (tunnel) {
      setTimeout(function () { tunnel.tunnelSpawning = false; }, 350);
    })(s);
  }
}
