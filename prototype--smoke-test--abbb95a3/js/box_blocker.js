// ============================================================
// box_blocker.js — Blocker box type
// Contains MRB_PER_BOX - BLOCKER_PER_BOX regular marbles plus
// BLOCKER_PER_BOX neutral blocker marbles. Visually distinct
// with diagonal stripe pattern and stone marble indicators.
// ============================================================

registerBoxType('blocker', {
  label: 'Blocker',
  editorColor: '#7A7068',

  drawClosed: function (ctx, x, y, w, h, ci, S, tick, idlePhase) {
    var c = COLORS[ci];
    var bc = COLORS[BLOCKER_CI];

    ctx.save();

    // Base colored box (slightly desaturated)
    ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 4 * S; ctx.shadowOffsetY = 2 * S;
    ctx.globalAlpha = 0.55;
    var grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, c.light); grad.addColorStop(1, c.dark);
    ctx.fillStyle = grad;
    rRect(x, y, w, h, 6 * S); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // Diagonal stripe overlay (blocker hazard indicator)
    ctx.globalAlpha = 0.18;
    ctx.save();
    ctx.beginPath();
    rRect(x, y, w, h, 6 * S);
    ctx.clip();
    ctx.strokeStyle = bc.fill;
    ctx.lineWidth = 3 * S;
    var stripeGap = 10 * S;
    for (var d = -w; d < w + h; d += stripeGap) {
      ctx.beginPath();
      ctx.moveTo(x + d, y);
      ctx.lineTo(x + d - h, y + h);
      ctx.stroke();
    }
    ctx.restore();

    // Border
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = c.dark; ctx.lineWidth = 1.5 * S;
    rRect(x, y, w, h, 6 * S); ctx.stroke();

    // Stone marble indicators (3 small gray circles)
    ctx.globalAlpha = 0.55;
    var dotR = w * 0.075;
    var dotY = y + h * 0.75;
    var dotGap = w * 0.22;
    var dotCx = x + w / 2;
    for (var d = -1; d <= 1; d++) {
      var grd = ctx.createRadialGradient(dotCx + d * dotGap, dotY, 0, dotCx + d * dotGap, dotY, dotR);
      grd.addColorStop(0, bc.light); grd.addColorStop(1, bc.dark);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(dotCx + d * dotGap, dotY, dotR, 0, Math.PI * 2); ctx.fill();
    }

    // Lock icon
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + (h * 0.28) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('\uD83D\uDD12', x + w / 2, y + h * 0.38);

    ctx.restore();
  },

  drawReveal: function (ctx, x, y, w, h, ci, S, phase, remaining, tick) {
    var popScale = 1 + Math.sin(phase * Math.PI) * 0.1;
    ctx.save();
    ctx.scale(popScale, popScale);

    if (phase < 0.5) {
      ctx.globalAlpha = 1 - phase * 2;
      this.drawClosed(ctx, x, y, w, h, ci, S, tick, 0);
      ctx.globalAlpha = phase * 2;
    }

    // Draw the box body
    drawBox(x, y, w, h, ci);

    // Subtle stripe overlay on box body during reveal
    if (phase < 0.7) {
      var bc = COLORS[BLOCKER_CI];
      ctx.globalAlpha = 0.08 * (1 - phase);
      ctx.save();
      ctx.beginPath();
      rRect(x, y, w, h, 6 * S);
      ctx.clip();
      ctx.strokeStyle = bc.fill;
      ctx.lineWidth = 2 * S;
      var stripeGap = 10 * S;
      for (var d = -w; d < w + h; d += stripeGap) {
        ctx.beginPath(); ctx.moveTo(x + d, y); ctx.lineTo(x + d - h, y + h); ctx.stroke();
      }
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    if (remaining > 0 && phase > 0.3) {
      ctx.globalAlpha = Math.min(1, (phase - 0.3) / 0.5);
      var blockerCount = Math.min(BLOCKER_PER_BOX, remaining);
      drawBoxMarblesWithBlockers(ci, remaining, blockerCount);
      ctx.globalAlpha = 1;
      drawBoxLip(ci);
    }
    ctx.restore();
  },

  editorCellStyle: function (ci) {
    var c = COLORS[ci];
    var bc = COLORS[BLOCKER_CI];
    return {
      background: 'linear-gradient(135deg,' + c.light + ' 60%,' + bc.fill + ')',
      borderColor: bc.dark
    };
  },

  editorCellHTML: function (ci) {
    return '<span class="ed-cell-dot" style="font-size:9px">' + CLR_NAMES[ci][0].toUpperCase() + '<span style="color:#A89E94;font-size:7px">&#9679;</span></span>';
  }
});
