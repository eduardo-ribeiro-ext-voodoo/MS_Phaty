// ============================================================
// wall.js — Wall cell type
// A purely structural element that occupies a grid cell.
// Walls don't contain marbles, can't be tapped, don't reveal,
// and don't interact with any game mechanics. They simply
// block the cell so it is not empty.
// ============================================================

function drawWallOnGrid(ctx, x, y, w, h, S, tick) {
  ctx.save();

  // Base stone color with gradient
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 4 * S;
  ctx.shadowOffsetY = 2 * S;
  var grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#9A8D7B');
  grad.addColorStop(0.4, '#8A7D6B');
  grad.addColorStop(1, '#6F6355');
  ctx.fillStyle = grad;
  rRect(x, y, w, h, 6 * S); ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Brick / stone block pattern
  ctx.save();
  ctx.beginPath();
  rRect(x, y, w, h, 6 * S);
  ctx.clip();

  var brickH = h / 3;

  // Mortar lines (horizontal)
  ctx.strokeStyle = 'rgba(60,50,35,0.18)';
  ctx.lineWidth = 1.5 * S;
  for (var r = 1; r < 3; r++) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * brickH);
    ctx.lineTo(x + w, y + r * brickH);
    ctx.stroke();
  }

  // Mortar lines (vertical, offset per row)
  for (var r = 0; r < 3; r++) {
    var offset = (r % 2 === 0) ? w * 0.5 : w * 0.25;
    ctx.beginPath();
    ctx.moveTo(x + offset, y + r * brickH);
    ctx.lineTo(x + offset, y + (r + 1) * brickH);
    ctx.stroke();

    if (r % 2 === 1) {
      ctx.beginPath();
      ctx.moveTo(x + offset + w * 0.5, y + r * brickH);
      ctx.lineTo(x + offset + w * 0.5, y + (r + 1) * brickH);
      ctx.stroke();
    }
  }

  // Subtle stone texture (random dots)
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  var seed = (x * 7 + y * 13) | 0;
  for (var d = 0; d < 8; d++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    var dx = x + (seed % 100) / 100 * w;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    var dy = y + (seed % 100) / 100 * h;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    var dr = (1 + (seed % 3)) * S;
    ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();

  // Border
  ctx.strokeStyle = 'rgba(80,65,45,0.45)';
  ctx.lineWidth = 1.5 * S;
  rRect(x, y, w, h, 6 * S); ctx.stroke();

  // Top-left highlight
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(x + 6 * S, y);
  ctx.lineTo(x + w - 6 * S, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + 6 * S);
  ctx.lineTo(x + w - 4 * S, y + 4 * S);
  ctx.lineTo(x + 4 * S, y + 4 * S);
  ctx.lineTo(x + 4 * S, y + h * 0.3);
  ctx.lineTo(x, y + 6 * S);
  ctx.quadraticCurveTo(x, y, x + 6 * S, y);
  ctx.fill();

  ctx.restore();
}
