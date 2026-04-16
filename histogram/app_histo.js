const drawCanvas = document.getElementById("draw");
const dctx = drawCanvas.getContext("2d");

const clearBtn = document.getElementById("clearBtn");

const previewCanvas = document.getElementById("preview");
const pctx = previewCanvas.getContext("2d");

const rowHistCanvas = document.getElementById("rowHist");
const rhctx = rowHistCanvas.getContext("2d");

const colHistCanvas = document.getElementById("colHist");
const chctx = colHistCanvas.getContext("2d");

const resultEl = document.getElementById("result");
const scoresEl = document.getElementById("scores");

const brushSizeEl = document.getElementById("brushSize");
const brushValEl = document.getElementById("brushVal");

const thrEl = document.getElementById("thr");
const thrValEl = document.getElementById("thrVal");

const marginEl = document.getElementById("margin");
const marginValEl = document.getElementById("marginVal");

const postThrEl = document.getElementById("postThr");
const postThrValEl = document.getElementById("postThrVal");

const rowDiffCanvas = document.getElementById("rowDiff");
const rdctx = rowDiffCanvas ? rowDiffCanvas.getContext("2d") : null;

const colDiffCanvas = document.getElementById("colDiff");
const cdctx = colDiffCanvas ? colDiffCanvas.getContext("2d") : null;

let drawing = false;
let last = null;

function setBrush() {
    dctx.lineCap = "round";
    dctx.lineJoin = "round";
    dctx.lineWidth = Number(brushSizeEl.value);
    dctx.strokeStyle = "white";
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

function absDiff(a, b) {
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.abs(a[i] - b[i]);
    return out;
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

function drawOverlayBars(ctx, userArr, templArr) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, W, H);

    let max = 0;
    for (let i = 0; i < userArr.length; i++) {
        max = Math.max(max, userArr[i], templArr[i]);
    }
    if (max <= 0) return;

    const pad = 10;
    const barW = (W - pad * 2) / userArr.length;

    ctx.fillStyle = "#6f6f6f";
    for (let i = 0; i < templArr.length; i++) {
        const h = (templArr[i] / max) * (H - pad * 2);
        const x = pad + i * barW;
        const y = H - pad - h;
        ctx.fillRect(x, y, Math.max(1, barW - 1), h);
    }

    ctx.fillStyle = "#e6e6e6";
    for (let i = 0; i < userArr.length; i++) {
        const h = (userArr[i] / max) * (H - pad * 2);
        const x = pad + i * barW;
        const y = H - pad - h;
        ctx.fillRect(x, y, Math.max(1, barW - 1), h);
    }
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

function drawOverlayBarsHorizontal(ctx, userArr, templArr) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, W, H);

    let max = 0;
    for (let i = 0; i < userArr.length; i++) {
        max = Math.max(max, userArr[i], templArr[i]);
    }
    if (max <= 0) return;

    const pad = 10;
    const barH = (H - pad * 2) / userArr.length;

    ctx.fillStyle = "#6f6f6f";
    for (let i = 0; i < templArr.length; i++) {
        const w = (templArr[i] / max) * (W - pad * 2);

        const x = W - pad - w;
        const y = pad + i * barH;

        ctx.fillRect(x, y, w, Math.max(1, barH - 1));
    }

    ctx.fillStyle = "#e6e6e6";
    for (let i = 0; i < userArr.length; i++) {
        const w = (userArr[i] / max) * (W - pad * 2);

        const x = W - pad - w;
        const y = pad + i * barH;

        ctx.fillRect(x, y, w, Math.max(1, barH - 1));
    }
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

async function init() {
    syncLabels();
    setBrush();

    dctx.fillStyle = "black";
    dctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);

    const userTemplates = await loadUserTemplatesFromJson();
    HIST_BANK = buildHistogramBank(userTemplates);

    console.log("Histogram bank:", HIST_BANK.length);
    clearDraw();
}

function drawBars(ctx, arr) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, W, H);

    let max = 0;
    for (let i = 0; i < arr.length; i++) max = Math.max(max, arr[i]);
    if (max <= 0) return;

    const pad = 10;
    const barW = (W - pad * 2) / arr.length;

    ctx.fillStyle = "#d8d8d8";
    for (let i = 0; i < arr.length; i++) {
        const h = (arr[i] / max) * (H - pad * 2);
        const x = pad + i * barW;
        const y = H - pad - h;
        ctx.fillRect(x, y, Math.max(1, barW - 1), h);
    }
}

function recomputeAndRender() {
    const vec = preprocessTo28x28FromDraw();
    render28ToPreview(vec, 28);

    const userH = projectionHistograms(vec, 28);

    const { best, perDigitTop, bestOverall } = matchByHistograms(vec);

    resultEl.textContent = best ? String(best.digit) : "—";
    scoresEl.innerHTML = "";

    const percents = softmaxPercents(perDigitTop, x => x.score, 0.08);

    perDigitTop.slice(0, 3).forEach((s, i) => {
        const li = document.createElement("li");
        li.textContent = `${s.digit}  -  ${percents[i].toFixed(1)}%`;
        scoresEl.appendChild(li);
    });

    if (bestOverall && bestOverall.t) {
        const tRow = bestOverall.t.row;
        const tCol = bestOverall.t.col;

        drawOverlayBarsHorizontal(rhctx, userH.row, tRow);

        drawOverlayBars(chctx, userH.col, tCol);

        if (rdctx && cdctx) {
            drawBarsHorizontal(rdctx, absDiff(userH.row, tRow));
            drawBars(cdctx, absDiff(userH.col, tCol));
        }
    } else {
        drawBarsHorizontal(rhctx, userH.row);
        drawBars(chctx, userH.col);
        if (rdctx && cdctx) {
            drawBarsHorizontal(rdctx, new Float32Array(28));
            drawBars(cdctx, new Float32Array(28));
        }

    }
}

function clearDraw() {
    dctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    dctx.fillStyle = "black";
    dctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);

    resultEl.textContent = "—";
    scoresEl.innerHTML = "";

    clearPreview();
    clearHistograms();
    recomputeAndRender();
}

function clearPreview() {
    pctx.fillStyle = "black";
    pctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
}

function clearHistograms() {
    rhctx.clearRect(0, 0, rowHistCanvas.width, rowHistCanvas.height);
    chctx.clearRect(0, 0, colHistCanvas.width, colHistCanvas.height);

    rhctx.fillStyle = "black";
    rhctx.fillRect(0, 0, rowHistCanvas.width, rowHistCanvas.height);

    chctx.fillStyle = "black";
    chctx.fillRect(0, 0, colHistCanvas.width, colHistCanvas.height);

    if (rdctx && rowDiffCanvas) {
        rdctx.fillStyle = "black";
        rdctx.fillRect(0, 0, rowDiffCanvas.width, rowDiffCanvas.height);
    }

    if (cdctx && colDiffCanvas) {
        cdctx.fillStyle = "black";
        cdctx.fillRect(0, 0, colDiffCanvas.width, colDiffCanvas.height);
    }
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
    const W = srcCanvas.width, H = srcCanvas.height;
    const raw = ctx.getImageData(0, 0, W, H);

    let minX = W, minY = H, maxX = -1, maxY = -1;

    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const r = raw.data[i], g = raw.data[i + 1], b = raw.data[i + 2];
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

function renderDigitTo28(digit, font) {
    const c = document.createElement("canvas");
    c.width = 160; c.height = 160;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "black"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "white";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = font;
    ctx.fillText(String(digit), c.width / 2, c.height / 2 + 4);

    return preprocessTo28x28FromCanvas(c, { threshold: 20, margin: 6, postThr: 128 });
}

let HIST_BANK = [];

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

function softmaxPercents(items, getScore = (x) => x.score, temperature = 0.08) {
    const scores = items.map(getScore);

    const maxS = Math.max(...scores);
    const exps = scores.map(s => Math.exp((s - maxS) / temperature));
    const sum = exps.reduce((a, b) => a + b, 0) || 1;

    return exps.map(e => (e / sum) * 100);
}

function cosineSim(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
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

    return { best: perDigitTop[0], perDigitTop, scored, inH, bestOverall };
}

drawCanvas.addEventListener("pointerdown", (e) => { drawCanvas.setPointerCapture(e.pointerId); onDown(e); });
drawCanvas.addEventListener("pointermove", onMove);
drawCanvas.addEventListener("pointerup", onUp);
drawCanvas.addEventListener("pointercancel", onUp);

clearBtn.addEventListener("click", clearDraw);

function syncLabels() {
    brushValEl.textContent = brushSizeEl.value;
    thrValEl.textContent = thrEl.value;
    marginValEl.textContent = marginEl.value;
    postThrValEl.textContent = postThrEl.value;
}

brushSizeEl.addEventListener("input", () => { syncLabels(); setBrush(); });
thrEl.addEventListener("input", () => { syncLabels(); recomputeAndRender(); });
marginEl.addEventListener("input", () => { syncLabels(); recomputeAndRender(); });
postThrEl.addEventListener("input", () => { syncLabels(); recomputeAndRender(); });

init();