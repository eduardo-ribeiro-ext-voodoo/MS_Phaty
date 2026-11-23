// ============================================================
// box_hidden.js — Hidden box type
// Closed: dark purple-black with "?" — color unknown
// Reveal: wobble → pop → color revealed
// ============================================================

registerBoxType('hidden', {
  label: 'Hidden',
  editorColor: '#4A4450',

  drawClosed: function (ctx, x, y, w, h, ci, S, tick, idlePhase) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 4 * S; ctx.shadowOffsetY = 2 * S;
    var grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#4A4450'); grad.addColorStop(1, '#2A2530');
    ctx.fillStyle = grad;
    rRect(x, y, w, h, 6 * S); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#5A5460'; ctx.lineWidth = 1.5 * S;
    rRect(x, y, w, h, 6 * S); ctx.stroke();
    // ? mark
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold ' + (h * 0.5) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', x + w / 2, y + h / 2);
    // Subtle sparkle
    ctx.fillStyle = 'rgba(200,180,255,0.12)';
    ctx.beginPath(); ctx.arc(x + w * 0.7, y + h * 0.25, w * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  drawReveal: function (ctx, x, y, w, h, ci, S, phase, remaining, tick) {
    if (phase < 0.5) {
      // Wobble the hidden shell
      var wobble = Math.sin(phase * Math.PI * 8) * (1 - phase * 2) * 6 * S;
      var squash = 1 + Math.sin(phase * Math.PI * 4) * 0.08;
      ctx.save();
      ctx.rotate(wobble * 0.02);
      ctx.scale(squash, 2 - squash);
      this.drawClosed(ctx, x, y, w, h, ci, S, tick, 0);
      ctx.restore();
    } else {
      // Pop to revealed color
      var t2 = (phase - 0.5) * 2;
      var popScale = 1 + Math.sin(t2 * Math.PI) * 0.15;
      ctx.save();
      ctx.scale(popScale, popScale);
      if (t2 < 0.4) {
        ctx.globalAlpha = 1 - t2 * 2.5;
        this.drawClosed(ctx, x, y, w, h, ci, S, tick, 0);
        ctx.globalAlpha = t2 * 2.5;
      }
      drawBox(x, y, w, h, ci);
      ctx.globalAlpha = 1;
      if (remaining > 0 && t2 > 0.3) {
        ctx.globalAlpha = Math.min(1, (t2 - 0.3) / 0.4);
        drawBoxMarbles(ci, remaining);
        ctx.globalAlpha = 1;
        drawBoxLip(ci);
      }
      ctx.restore();
    }
  },

  editorCellStyle: function (ci) {
    return { background: 'linear-gradient(135deg,#4A4450,#2A2530)', borderColor: '#5A5460' };
  },

  editorCellHTML: function (ci) {
    return '<span class="ed-cell-dot" style="color:#ddd">?</span>';
  }
});
