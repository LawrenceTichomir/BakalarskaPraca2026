const drawCanvas = document.getElementById("draw");
const dctx = drawCanvas.getContext("2d");

const clearBtn = document.getElementById("clearBtn");

const previewCanvas = document.getElementById("preview");
const pctx = previewCanvas.getContext("2d");

const templateResultEl = document.getElementById("templateResult");
const templateScoresEl = document.getElementById("templateScores");
const templateBestCanvas = document.getElementById("templateBestCanvas");
const tbctx = templateBestCanvas.getContext("2d");

const histResultEl = document.getElementById("histResult");
const histScoresEl = document.getElementById("histScores");
const histRowCanvas = document.getElementById("histRowCanvas");
const hrctx = histRowCanvas.getContext("2d");

const zoneResultEl = document.getElementById("zoneResult");
const zoneScoresEl = document.getElementById("zoneScores");
const zoneCanvas = document.getElementById("zoneCanvas");
const zctx = zoneCanvas.getContext("2d");

const brushSizeEl = document.getElementById("brushSize");
const brushValEl = document.getElementById("brushVal");

const thrEl = document.getElementById("thr");
const thrValEl = document.getElementById("thrVal");

const marginEl = document.getElementById("margin");
const marginValEl = document.getElementById("marginVal");

const postThrEl = document.getElementById("postThr");
const postThrValEl = document.getElementById("postThrVal");

let drawing = false;
let last = null;

let TEMPLATE_BANK = [];
let HIST_BANK = [];
let ZONE_BANK = [];

function setBrush() {
  dctx.lineCap = "round";
  dctx.lineJoin = "round";
  dctx.lineWidth = Number(brushSizeEl.value);
  dctx.strokeStyle = "white";
}

function clearDraw() {
  dctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  dctx.fillStyle = "black";
  dctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);

  templateResultEl.textContent = "—";
  histResultEl.textContent = "—";
  zoneResultEl.textContent = "—";

  templateScoresEl.innerHTML = "";
  histScoresEl.innerHTML = "";
  zoneScoresEl.innerHTML = "";

  clearPreview();
  clearCanvas(tbctx, templateBestCanvas);
  clearCanvas(hrctx, histRowCanvas);
  clearCanvas(zctx, zoneCanvas);

  recomputeAndRender();
}

function clearPreview() {
  pctx.fillStyle = "black";
  pctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
}

function clearCanvas(ctx, canvas) {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function getPos(e) {
  const r = drawCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (drawCanvas.width / r.width),
    y: (e.clientY - r.top) * (drawCanvas.height / r.height),
  };
}

function onDown(e) {
  drawing = true;
  last = getPos(e);
}

function onMove(e) {
  if (!drawing) return;
  const pos = getPos(e);
  dctx.beginPath();
  dctx.moveTo(last.x, last.y);
  dctx.lineTo(pos.x, pos.y);
  dctx.stroke();
  last = pos;
}

function onUp() {
  drawing = false;
  last = null;
  recomputeAndRender();
}

function preprocessTo28x28FromDraw() {
  return preprocessTo28x28FromCanvas(drawCanvas, {
    threshold: Number(thrEl.value),
    margin: Number(marginEl.value),
    postThr: Number(postThrEl.value),
  });
}

function preprocessTo28x28FromCanvas(srcCanvas, opts) {
  const size = 28;
  const threshold = opts.threshold ?? 20;
  const margin = opts.margin ?? 6;
  const postThr = opts.postThr ?? 128;

  const ctx = srcCanvas.getContext("2d");
  const W = srcCanvas.width;
  const H = srcCanvas.height;
  const raw = ctx.getImageData(0, 0, W, H);

  let minX = W, minY = H, maxX = -1, maxY = -1;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = raw.data[i];
      const g = raw.data[i + 1];
      const b = raw.data[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      if (lum > threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return new Float32Array(size * size);

  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  maxX = Math.min(W - 1, maxX + margin);
  maxY = Math.min(H - 1, maxY + margin);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  const cropC = document.createElement("canvas");
  cropC.width = cropW;
  cropC.height = cropH;
  const cctx = cropC.getContext("2d");
  cctx.drawImage(srcCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  const side = Math.max(cropW, cropH);
  const sqC = document.createElement("canvas");
  sqC.width = side;
  sqC.height = side;
  const sctx = sqC.getContext("2d");
  sctx.fillStyle = "black";
  sctx.fillRect(0, 0, side, side);

  const dx = Math.floor((side - cropW) / 2);
  const dy = Math.floor((side - cropH) / 2);
  sctx.drawImage(cropC, dx, dy);

  const outC = document.createElement("canvas");
  outC.width = size;
  outC.height = size;
  const octx = outC.getContext("2d");
  octx.fillStyle = "black";
  octx.fillRect(0, 0, size, size);
  octx.drawImage(sqC, 0, 0, size, size);

  const resized = octx.getImageData(0, 0, size, size);

  const vec = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const v = resized.data[i * 4];
    vec[i] = v > postThr ? 1 : 0;
  }

  return vec;
}

function render28ToPreview(vec, size = 28) {
  const scale = Math.floor(previewCanvas.width / size);
  pctx.fillStyle = "black";
  pctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = vec[y * size + x] ? 255 : 0;
      pctx.fillStyle = `rgb(${v},${v},${v})`;
      pctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

function renderVecToCanvas(ctx, canvas, vec, size = 28) {
  const scale = Math.floor(canvas.width / size);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = vec[y * size + x] ? 255 : 0;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

function renderDigitTo28(digit, font) {
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 160;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font;
  ctx.fillText(String(digit), c.width / 2, c.height / 2 + 4);

  return preprocessTo28x28FromCanvas(c, {
    threshold: 20,
    margin: 6,
    postThr: 128,
  });
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function softmaxPercents(items, getScore = (x) => x.score, temperature = 0.08) {
  const scores = items.map(getScore);
  const maxS = Math.max(...scores);
  const exps = scores.map(s => Math.exp((s - maxS) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map(e => (e / sum) * 100);
}

function renderTopScores(listEl, perDigitTop, topN = 3) {
  listEl.innerHTML = "";
  const percents = softmaxPercents(perDigitTop, x => x.score, 0.08);

  perDigitTop.slice(0, topN).forEach((s, i) => {
    const li = document.createElement("li");
    li.textContent = `${s.digit} - ${percents[i].toFixed(1)}%`;
    listEl.appendChild(li);
  });
}

async function loadUserTemplatesFromJson() {
  try {
    const res = await fetch("../data/user_templates.json");
    if (!res.ok) return [];

    const json = await res.json();
    const templates = json?.templates;
    if (!Array.isArray(templates)) return [];

    return templates
      .filter(item =>
        typeof item?.digit === "number" &&
        Array.isArray(item?.vec) &&
        item.vec.length === 28 * 28
      )
      .map(item => ({
        digit: item.digit,
        vec: new Float32Array(item.vec),
        createdAt: item.createdAt ?? Date.now(),
        source: "user",
      }));
  } catch (err) {
    console.error("Could not load user_templates.json:", err);
    return [];
  }
}

function buildTemplateBank(userTemplates = []) {
  const fonts = [
    "bold 130px Arial",
    "bold 130px Verdana",
    "bold 130px 'Trebuchet MS'",
    "bold 130px Georgia",

  ];

  const bank = [];

  for (let digit = 0; digit <= 9; digit++) {
    for (const font of fonts) {
      const vec = renderDigitTo28(digit, font);
      bank.push({
        digit,
        font,
        vec,
        source: "font",
      });
    }
  }

  userTemplates.forEach(t => {
    bank.push({
      digit: t.digit,
      font: "user",
      vec: t.vec,
      source: "user",
      createdAt: t.createdAt,
    });
  });

  return bank;
}

function normalizedCorrelation(a, b) {
  const n = a.length;
  let meanA = 0, meanB = 0;

  for (let i = 0; i < n; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;

  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const denom = Math.sqrt(denA * denB);
  return denom === 0 ? -Infinity : num / denom;
}

function matchAgainstTemplates(inputVec) {
  const scored = TEMPLATE_BANK.map(t => ({
    digit: t.digit,
    font: t.font,
    score: normalizedCorrelation(inputVec, t.vec),
    t,
  }));

  scored.sort((a, b) => b.score - a.score);

  const bestPerDigit = new Map();
  for (const s of scored) {
    if (!bestPerDigit.has(s.digit)) bestPerDigit.set(s.digit, s);
  }

  const perDigitTop = Array.from(bestPerDigit.values()).sort((a, b) => b.score - a.score);
  const bestOverall = scored[0] ?? null;

  return {
    best: perDigitTop[0] ?? null,
    perDigitTop,
    bestOverall,
  };
}

function normalizeToSum1(a) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i];
  if (sum === 0) return;
  for (let i = 0; i < a.length; i++) a[i] /= sum;
}

function projectionHistograms(vec, size = 28) {
  const row = new Float32Array(size);
  const col = new Float32Array(size);

  for (let y = 0; y < size; y++) {
    let s = 0;
    for (let x = 0; x < size; x++) s += vec[y * size + x];
    row[y] = s;
  }

  for (let x = 0; x < size; x++) {
    let s = 0;
    for (let y = 0; y < size; y++) s += vec[y * size + x];
    col[x] = s;
  }

  normalizeToSum1(row);
  normalizeToSum1(col);
  return { row, col };
}

function buildHistogramBank(userTemplates = []) {
  const fonts = [
    "bold 130px Arial",
    "bold 130px Verdana",
    "bold 130px 'Trebuchet MS'",
    "bold 130px Georgia",
    "bold 130px 'Brush Script MT'",
    "bold 130px 'Pacifico'",
    "bold 130px 'Dancing Script'",
  ];

  const bank = [];

  for (let digit = 0; digit <= 9; digit++) {
    for (const font of fonts) {
      const vec = renderDigitTo28(digit, font);
      const { row, col } = projectionHistograms(vec, 28);
      bank.push({
        digit,
        font,
        row,
        col,
        vec,
        source: "font",
      });
    }
  }

  userTemplates.forEach(t => {
    const { row, col } = projectionHistograms(t.vec, 28);
    bank.push({
      digit: t.digit,
      font: "user",
      row,
      col,
      vec: t.vec,
      source: "user",
      createdAt: t.createdAt,
    });
  });

  return bank;
}

function matchByHistograms(inputVec) {
  const inH = projectionHistograms(inputVec, 28);

  const scored = HIST_BANK.map(t => {
    const sRow = cosineSim(inH.row, t.row);
    const sCol = cosineSim(inH.col, t.col);
    const score = (sRow + sCol) / 2;
    return { digit: t.digit, font: t.font, score, t };
  });

  scored.sort((a, b) => b.score - a.score);

  const bestPerDigit = new Map();
  for (const s of scored) {
    if (!bestPerDigit.has(s.digit)) bestPerDigit.set(s.digit, s);
  }

  const perDigitTop = Array.from(bestPerDigit.values()).sort((a, b) => b.score - a.score);
  const bestOverall = scored[0] ?? null;

  return {
    best: perDigitTop[0] ?? null,
    perDigitTop,
    bestOverall,
    inH,
  };
}

function drawBarsHorizontal(ctx, arr) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, W, H);

  let max = 0;
  for (let i = 0; i < arr.length; i++) max = Math.max(max, arr[i]);
  if (max <= 0) return;

  const pad = 10;
  const barH = (H - pad * 2) / arr.length;

  ctx.fillStyle = "#d8d8d8";
  for (let i = 0; i < arr.length; i++) {
    const w = (arr[i] / max) * (W - pad * 2);
    const x = W - pad - w;
    const y = pad + i * barH;
    ctx.fillRect(x, y, w, Math.max(1, barH - 1));
  }
}

function zoningFeatures(vec, size = 28, grid = 4) {
  const cellSize = Math.floor(size / grid);
  const features = [];

  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      let sum = 0;
      for (let y = 0; y < cellSize; y++) {
        for (let x = 0; x < cellSize; x++) {
          const px = gx * cellSize + x;
          const py = gy * cellSize + y;
          sum += vec[py * size + px];
        }
      }
      features.push(sum / (cellSize * cellSize));
    }
  }

  return features;
}

function buildZoneBank(userTemplates = []) {
  const fonts = [
    "bold 130px Arial",
    "bold 130px Verdana",
    "bold 130px 'Trebuchet MS'",
    "bold 130px Georgia",
    "bold 130px 'Brush Script MT'",
    "bold 130px 'Pacifico'",
    "bold 130px 'Dancing Script'",
  ];

  const bank = [];

  for (let digit = 0; digit <= 9; digit++) {
    for (const font of fonts) {
      const vec = renderDigitTo28(digit, font);
      const features = zoningFeatures(vec, 28, 4);
      bank.push({
        digit,
        font,
        features,
        vec,
        source: "font",
      });
    }
  }

  userTemplates.forEach(t => {
    const features = zoningFeatures(t.vec, 28, 4);
    bank.push({
      digit: t.digit,
      font: "user",
      features,
      vec: t.vec,
      source: "user",
      createdAt: t.createdAt,
    });
  });

  return bank;
}

function matchByZoning(inputVec) {
  const inputFeat = zoningFeatures(inputVec, 28, 4);

  const scored = ZONE_BANK.map(t => {
    const score = cosineSim(inputFeat, t.features);
    return { digit: t.digit, font: t.font, score, t };
  });

  scored.sort((a, b) => b.score - a.score);

  const bestPerDigit = new Map();
  for (const s of scored) {
    if (!bestPerDigit.has(s.digit)) bestPerDigit.set(s.digit, s);
  }

  const perDigitTop = Array.from(bestPerDigit.values()).sort((a, b) => b.score - a.score);
  const bestOverall = scored[0] ?? null;

  return {
    best: perDigitTop[0] ?? null,
    perDigitTop,
    bestOverall,
  };
}

function drawZoningGridToCanvas(ctx, canvas, vec, size = 28, grid = 4) {
  const W = canvas.width;
  const H = canvas.height;
  const cellW = W / grid;
  const cellH = H / grid;

  const features = zoningFeatures(vec, size, grid);

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, W, H);

  let i = 0;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const density = features[i++];
      ctx.fillStyle = `rgba(0, 255, 150, ${density})`;
      ctx.fillRect(gx * cellW, gy * cellH, cellW, cellH);

      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.strokeRect(gx * cellW, gy * cellH, cellW, cellH);
    }
  }
}

function recomputeAndRender() {
  const vec = preprocessTo28x28FromDraw();
  render28ToPreview(vec, 28);

  const templateOut = matchAgainstTemplates(vec);
  templateResultEl.textContent = templateOut.best ? String(templateOut.best.digit) : "—";
  renderTopScores(templateScoresEl, templateOut.perDigitTop, 3);

  if (templateOut.bestOverall?.t?.vec) {
    renderVecToCanvas(tbctx, templateBestCanvas, templateOut.bestOverall.t.vec, 28);
  } else {
    clearCanvas(tbctx, templateBestCanvas);
  }

  const histOut = matchByHistograms(vec);
  histResultEl.textContent = histOut.best ? String(histOut.best.digit) : "—";
  renderTopScores(histScoresEl, histOut.perDigitTop, 3);
  drawBarsHorizontal(hrctx, histOut.inH.row);

  const zoneOut = matchByZoning(vec);
  zoneResultEl.textContent = zoneOut.best ? String(zoneOut.best.digit) : "—";
  renderTopScores(zoneScoresEl, zoneOut.perDigitTop, 3);
  drawZoningGridToCanvas(zctx, zoneCanvas, vec, 28, 4);
}

function syncLabels() {
  brushValEl.textContent = brushSizeEl.value;
  thrValEl.textContent = thrEl.value;
  marginValEl.textContent = marginEl.value;
  postThrValEl.textContent = postThrEl.value;
}

drawCanvas.addEventListener("pointerdown", (e) => {
  drawCanvas.setPointerCapture(e.pointerId);
  onDown(e);
});
drawCanvas.addEventListener("pointermove", onMove);
drawCanvas.addEventListener("pointerup", onUp);
drawCanvas.addEventListener("pointercancel", onUp);

clearBtn.addEventListener("click", clearDraw);

brushSizeEl.addEventListener("input", () => {
  syncLabels();
  setBrush();
});

thrEl.addEventListener("input", () => {
  syncLabels();
  recomputeAndRender();
});

marginEl.addEventListener("input", () => {
  syncLabels();
  recomputeAndRender();
});

postThrEl.addEventListener("input", () => {
  syncLabels();
  recomputeAndRender();
});

async function init() {
  syncLabels();
  setBrush();

  dctx.fillStyle = "black";
  dctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);

  const userTemplates = await loadUserTemplatesFromJson();

  TEMPLATE_BANK = buildTemplateBank(userTemplates);
  HIST_BANK = buildHistogramBank(userTemplates);
  ZONE_BANK = buildZoneBank(userTemplates);

  console.log("Template bank:", TEMPLATE_BANK.length);
  console.log("Histogram bank:", HIST_BANK.length);
  console.log("Zone bank:", ZONE_BANK.length);

  clearDraw();
}

init();