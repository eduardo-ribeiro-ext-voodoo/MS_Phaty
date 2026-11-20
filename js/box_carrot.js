// ============================================================
// box_carrot.js — Carrot box (Rabbit & Carrot prototype)
// A normal box with a Carrot resting on it. Looks and plays like a
// Default box; the Carrot itself is drawn by rabbit.js on top of the
// grid. Opening it sends the Carrot flying to the Rabbit.
// ============================================================

registerBoxType('carrot', {
  label: 'Carrot',
  editorColor: '#FF8A1F',

  drawClosed: function (ctx, x, y, w, h, ci, S, tick, idlePhase) {
    getBoxType('default').drawClosed(ctx, x, y, w, h, ci, S, tick, idlePhase);
  },

  drawReveal: function (ctx, x, y, w, h, ci, S, phase, remaining, tick) {
    getBoxType('default').drawReveal(ctx, x, y, w, h, ci, S, phase, remaining, tick);
  },

  editorCellStyle: function (ci) {
    var c = COLORS[ci];
    return { background: 'linear-gradient(135deg,' + c.light + ',' + c.dark + ')', borderColor: '#FF8A1F' };
  },

  editorCellHTML: function (ci) {
    return '<span class="ed-cell-dot">🥕</span>';
  }
});
