// ============================================================
// box_ice.js — Ice box type
// A box covered in ice (2 HP). Players must pick up 2 adjacent
// boxes to shatter the ice before the box becomes tappable.
// HP 2 → intact ice, HP 1 → cracked ice, HP 0 → free.
// ============================================================

registerBoxType('ice', {
  label: 'Ice',
  editorColor: '#89CFF0',

  // ── Draw ice overlay (called from drawStock after the base box) ──
  drawIceOverlay: function (ctx, x, y, w, h, S, hp, tick) {
    ctx.save();

    // ── Base ice layer ──
    var iceAlpha = hp >= 2 ? 0.55 : 0.38;
    var grad = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
    grad.addColorStop(0, 'rgba(180,225,255,' + iceAlpha + ')');
    grad.addColorStop(0.5, 'rgba(140,210,255,' + (iceAlpha * 0.7) + ')');
    grad.addColorStop(1, 'rgba(200,235,255,' + iceAlpha + ')');
    ctx.fillStyle = grad;
    rRect(x, y, w, h, 6 * S); ctx.fill();

    // ── Frosty border ──
    ctx.strokeStyle = hp >= 2
      ? 'rgba(160,220,255,0.7)'
      : 'rgba(160,220,255,0.45)';
    ctx.lineWidth = 2 * S;
    rRect(x, y, w, h, 6 * S); ctx.stroke();

    // ── Shimmer highlights ──
    var shimmer = Math.sin(tick * 0.05) * 0.08 + 0.15;
    ctx.fillStyle = 'rgba(255,255,255,' + shimmer + ')';
    ctx.beginPath(); ctx.arc(x + w * 0.25, y + h * 0.22, w * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w * 0.72, y + h * 0.35, w * 0.07, 0, Math.PI * 2); ctx.fill();

    // ── Small ice crystal shapes ──
    ctx.strokeStyle = 'rgba(255,255,255,' + (hp >= 2 ? 0.3 : 0.15) + ')';
    ctx.lineWidth = 1 * S;
    // Crystal 1
    var cx1 = x + w * 0.65, cy1 = y + h * 0.2, cr = w * 0.06;
    for (var a = 0; a < 3; a++) {
      var angle = a * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(cx1 - Math.cos(angle) * cr, cy1 - Math.sin(angle) * cr);
      ctx.lineTo(cx1 + Math.cos(angle) * cr, cy1 + Math.sin(angle) * cr);
      ctx.stroke();
    }
    // Crystal 2
    var cx2 = x + w * 0.3, cy2 = y + h * 0.7, cr2 = w * 0.05;
    for (var a = 0; a < 3; a++) {
      var angle = a * Math.PI / 3 + 0.5;
      ctx.beginPath();
      ctx.moveTo(cx2 - Math.cos(angle) * cr2, cy2 - Math.sin(angle) * cr2);
      ctx.lineTo(cx2 + Math.cos(angle) * cr2, cy2 + Math.sin(angle) * cr2);
      ctx.stroke();
    }

    // ── Cracks when HP = 1 ──
    if (hp === 1) {
      ctx.strokeStyle = 'rgba(100,80,60,0.35)';
      ctx.lineWidth = 1.5 * S;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Main diagonal crack
      ctx.beginPath();
      ctx.moveTo(x + w * 0.18, y + h * 0.12);
      ctx.lineTo(x + w * 0.35, y + h * 0.38);
      ctx.lineTo(x + w * 0.42, y + h * 0.35);
      ctx.lineTo(x + w * 0.55, y + h * 0.58);
      ctx.lineTo(x + w * 0.48, y + h * 0.65);
      ctx.lineTo(x + w * 0.62, y + h * 0.82);
      ctx.stroke();

      // Branch crack 1
      ctx.beginPath();
      ctx.moveTo(x + w * 0.35, y + h * 0.38);
      ctx.lineTo(x + w * 0.22, y + h * 0.55);
      ctx.stroke();

      // Branch crack 2
      ctx.beginPath();
      ctx.moveTo(x + w * 0.55, y + h * 0.58);
      ctx.lineTo(x + w * 0.75, y + h * 0.52);
      ctx.lineTo(x + w * 0.85, y + h * 0.60);
      ctx.stroke();

      // Branch crack 3
      ctx.beginPath();
      ctx.moveTo(x + w * 0.42, y + h * 0.35);
      ctx.lineTo(x + w * 0.58, y + h * 0.22);
      ctx.stroke();

      // White edge highlights along cracks
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 0.8 * S;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.19, y + h * 0.11);
      ctx.lineTo(x + w * 0.36, y + h * 0.37);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w * 0.56, y + h * 0.57);
      ctx.lineTo(x + w * 0.63, y + h * 0.81);
      ctx.stroke();
    }

    ctx.restore();
  },

  // ── Closed state: ice fully covers the box, color dimly visible ──
  drawClosed: function (ctx, x, y, w, h, ci, S, tick, idlePhase) {
    // Draw the underlying box dimly
    ctx.save();
    ctx.globalAlpha = 0.5;
    var c = COLORS[ci];
    var grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, c.light); grad.addColorStop(1, c.dark);
    ctx.fillStyle = grad;
    rRect(x, y, w, h, 6 * S); ctx.fill();
    ctx.restore();
    // Ice on top
    this.drawIceOverlay(ctx, x, y, w, h, S, 2, tick);
  },

  // ── Reveal animation (reveal the box under ice) ──
  drawReveal: function (ctx, x, y, w, h, ci, S, phase, remaining, tick) {
    var popScale = 1 + Math.sin(phase * Math.PI) * 0.08;
    ctx.save();
    ctx.scale(popScale, popScale);
    // Fade from closed to open-with-ice
    if (phase < 0.5) {
      ctx.globalAlpha = 1;
    }
    drawBox(x, y, w, h, ci);
    if (remaining > 0 && phase > 0.3) {
      ctx.globalAlpha = Math.min(1, (phase - 0.3) / 0.5);
      drawBoxMarbles(ci, remaining);
      ctx.globalAlpha = 1;
      drawBoxLip(ci);
    }
    // Ice overlay stays during reveal
    this.drawIceOverlay(ctx, x, y, w, h, S, 2, tick);
    ctx.restore();
  },

  editorCellStyle: function (ci) {
    var c = COLORS[ci];
    return {
      background: 'linear-gradient(135deg,' + c.light + ',' + c.dark + ')',
      borderColor: '#89CFF0'
    };
  },

  editorCellHTML: function (ci) {
    return '<span class="ed-cell-dot" style="text-shadow:0 0 4px rgba(140,210,255,0.8)">&#10052;</span>';
  }
});
