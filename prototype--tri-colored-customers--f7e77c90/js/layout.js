// ============================================================
// layout.js — Layout computation, resize, belt path, positions
// ============================================================

function computeLayout() {
  var cx = W / 2;

  // STOCK — 7x7 grid
  var sCal = cal.stock;
  var cols = 7, rows = 7;
  var bg2 = 4 * S * sCal.s;
  var bw = Math.floor((380 * S * sCal.s - (cols - 1) * bg2) / cols);
  var bh = bw;
  var gameW = cols * bw + (cols - 1) * bg2;
  var stockCx = cx + sCal.dx * S;
  var stockLeft = stockCx - gameW / 2;
  L.cx = cx; L.bw = bw; L.bh = bh; L.bg = bg2;
  L.cols = cols; L.rows = rows;
  L.gameW = gameW; L.gameLeft = stockLeft; L.gameRight = stockLeft + gameW;
  L.sx = stockLeft; L.sy = 46 * S + sCal.dy * S;

  // FUNNEL
  var fCal = cal.funnel;
  var funnelW = gameW * fCal.sw;
  var funnelCx = cx + fCal.dx * S;
  var funnelLeft = funnelCx - funnelW / 2;
  var funnelRight = funnelCx + funnelW / 2;
  var stockBot = L.sy + rows * (bh + bg2);
  L.funnelTop = stockBot + fCal.dy * S;
  L.funnelH = 190 * S * fCal.sh;
  L.funnelBot = L.funnelTop + L.funnelH;
  L.funnelLeft = funnelLeft; L.funnelRight = funnelRight;
  L.funnelCx = funnelCx;
  L.funnelOpenW = 32 * S * fCal.sw;
  L.funnelBendY = L.funnelTop + L.funnelH * 0.65;

  funnelWalls = [];
  var exitL = funnelCx - L.funnelOpenW / 2;
  var exitR = funnelCx + L.funnelOpenW / 2;
  funnelWalls.push({ x1: funnelLeft, y1: L.sy, x2: funnelLeft, y2: L.funnelBendY });
  funnelWalls.push({ x1: funnelRight, y1: L.sy, x2: funnelRight, y2: L.funnelBendY });
  funnelWalls.push({ x1: funnelLeft, y1: L.funnelBendY, x2: exitL, y2: L.funnelBot });
  funnelWalls.push({ x1: funnelRight, y1: L.funnelBendY, x2: exitR, y2: L.funnelBot });
  funnelWalls.push({ x1: 0, y1: L.funnelBot, x2: exitL, y2: L.funnelBot });
  funnelWalls.push({ x1: exitR, y1: L.funnelBot, x2: W, y2: L.funnelBot });
  funnelWalls.push({ x1: exitL, y1: L.funnelBot, x2: exitR, y2: L.funnelBot, isPlug: true });

  // BELT
  var bCal = cal.belt;
  var beltW = gameW * bCal.sw;
  var beltCx = cx + bCal.dx * S;
  var beltLeft = beltCx - beltW / 2;
  var beltTopY = L.funnelBot + 14 * S + bCal.dy * S;
  var beltGap = 24 * S * bCal.sh;
  var beltBotY = beltTopY + beltGap;
  var uR = beltGap / 2;
  var beltInnerLeft = beltLeft + uR;
  var beltInnerRight = beltLeft + beltW - uR;
  L.beltTopY = beltTopY; L.beltBotY = beltBotY;
  L.beltLeft = beltLeft; L.beltRight = beltLeft + beltW;
  L.beltCx = beltCx; L.beltGap = beltGap; L.uR = uR;

  beltPath = [];
  var segs = 200;
  var topLen = Math.max(1, beltInnerRight - beltInnerLeft);
  var botLen = topLen;
  var uLen = Math.PI * uR;
  var perim = topLen + botLen + 2 * uLen;
  for (var i = 0; i < segs; i++) {
    var d = (i / segs) * perim; var x, y;
    var s1 = topLen, s2 = s1 + uLen, s3 = s2 + botLen;
    if (d < s1) { x = beltInnerLeft + (d / topLen) * topLen; y = beltTopY; }
    else if (d < s2) { var a = ((d - s1) / uLen) * Math.PI; x = beltInnerRight + Math.sin(a) * uR; y = beltTopY + uR - Math.cos(a) * uR; }
    else if (d < s3) { x = beltInnerRight - ((d - s2) / botLen) * botLen; y = beltBotY; }
    else { var a = ((d - s3) / uLen) * Math.PI; x = beltInnerLeft - Math.sin(a) * uR; y = beltBotY - uR + Math.cos(a) * uR; }
    beltPath.push({ x: x, y: y });
  }

  // SORT
  var oCal = cal.sort;
  var sortW = gameW * oCal.s;
  var sortCx = cx + oCal.dx * S;
  L.sTop = beltBotY + 16 * S + oCal.dy * S;
  L.sBw = Math.floor((sortW - 3 * 7 * S * oCal.s) / 4);
  L.sBh = 32 * S * oCal.s; L.sGap = 3 * S * oCal.s; L.sColGap = 7 * S * oCal.s;
  var stw = 4 * L.sBw + 3 * L.sColGap;
  L.sSx = sortCx - stw / 2;

  // BACK BUTTON
  var bkCal = cal.back;
  var bkSize = 40 * S * bkCal.s;
  L.bkX = L.gameLeft + 8 * S + bkCal.dx * S;
  L.bkY = 10 * S + bkCal.dy * S;
  L.bkSize = bkSize;

  // Sort-belt alignment
  L.sortBeltT = [];
  for (var c = 0; c < 4; c++) {
    var colCx = L.sSx + c * (L.sBw + L.sColGap) + L.sBw / 2;
    var best = 0, bd = Infinity;
    for (var j = 0; j < beltPath.length; j++) {
      var dx2 = beltPath[j].x - colCx, dy2 = beltPath[j].y - L.beltBotY;
      var dist = dx2 * dx2 + dy2 * dy2;
      if (dist < bd) { bd = dist; best = j; }
    }
    L.sortBeltT.push(best / beltPath.length);
  }
}

function updateStockPositions() {
  if (!stock || !stock.length) return;
  for (var i = 0; i < stock.length; i++) {
    var r = Math.floor(i / L.cols); var c = i % L.cols;
    stock[i].x = L.sx + c * (L.bw + L.bg);
    stock[i].y = L.sy + r * (L.bh + L.bg);
  }
}

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W; canvas.height = H;
  S = H / 850;
  computeLayout();
  updateStockPositions();
}

window.addEventListener('resize', resize);
