// ============================================================
// box_default.js — Default box type
// Closed: color visible but greyed out / desaturated
// Reveal: quick brighten from greyed → full color
// ============================================================

registerBoxType('default', {
  label: 'Default',
  editorColor: '#A08060',

  drawClosed: function (ctx, x, y, w, h, ci, S, tick, idlePhase) {
    var c = COLORS[ci];
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 3 * S; ctx.shadowOffsetY = 1 * S;
    ctx.globalAlpha = 0.45;
    var grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, c.light); grad.addColorStop(1, c.dark);
    ctx.fillStyle = grad;
    rRect(x, y, w, h, 6 * S); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // Desaturation overlay
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#A09888';
    rRect(x, y, w, h, 6 * S); ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = c.dark; ctx.lineWidth = 1 * S;
    rRect(x, y, w, h, 6 * S); ctx.stroke();
    // Lock icon
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + (h * 0.3) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('\uD83D\uDD12', x + w / 2, y + h / 2);
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
    drawBox(x, y, w, h, ci);
    ctx.globalAlpha = 1;
    if (remaining > 0 && phase > 0.3) {
      ctx.globalAlpha = Math.min(1, (phase - 0.3) / 0.5);
      drawBoxMarbles(ci, remaining);
      ctx.globalAlpha = 1;
      drawBoxLip(ci);
    }
    ctx.restore();
  },

  editorCellStyle: function (ci) {
    var c = COLORS[ci];
    return { background: 'linear-gradient(135deg,' + c.light + ',' + c.dark + ')', borderColor: c.dark };
  },

  editorCellHTML: function (ci) {
    return '<span class="ed-cell-dot">' + CLR_NAMES[ci][0].toUpperCase() + '</span>';
  }
});
