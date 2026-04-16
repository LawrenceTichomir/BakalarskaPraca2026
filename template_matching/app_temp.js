const drawCanvas = document.getElementById("draw");
const dctx = drawCanvas.getContext("2d");

const clearBtn = document.getElementById("clearBtn");

const previewCanvas = document.getElementById("preview");
const pctx = previewCanvas.getContext("2d");

const resultEl = document.getElementById("result");
const scoresEl = document.getElementById("scores");

const stageCanvas = document.getElementById("stageView");
const svctx = stageCanvas.getContext("2d");
const prevStageBtn = document.getElementById("prevStage");
const nextStageBtn = document.getElementById("nextStage");
const stageNameEl = document.getElementById("stageName");
const stageInfoEl = document.getElementById("stageInfo");

const brushSizeEl = document.getElementById("brushSize");
const brushValEl = document.getElementById("brushVal");

const thrEl = document.getElementById("thr");
const thrValEl = document.getElementById("thrVal");

const marginEl = document.getElementById("margin");
const marginValEl = document.getElementById("marginVal");

const saveDigitEl = document.getElementById("saveDigit");
const saveTemplateBtn = document.getElementById("saveTemplateBtn");
const clearUserTemplatesBtn = document.getElementById("clearUserTemplatesBtn");

const exportTemplatesBtn = document.getElementById("exportTemplatesBtn");
const importTemplatesBtn = document.getElementById("importTemplatesBtn");
const importFileEl = document.getElementById("importFile");
const LS_KEY = "ocr_template_lab_user_templates_v1";

let PIPELINE = null;
let stageIndex = 0;

let TEMPLATE_BANK = [];

let drawing = false;
let last = null;


function setBrush() {
    dctx.lineCap = "round";
    dctx.lineJoin = "square";
    dctx.lineWidth = Number(brushSizeEl?.value);
    dctx.strokeStyle = "green";
}


function clearDraw() {
    dctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    dctx.fillStyle = "black";
    dctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);

    resultEl.textContent = "—";
    scoresEl.innerHTML = "";
    clearPreview();

    stageIndex = 0;
    recomputeAndRender();
}


function countTemplates() {
    const userCount = TEMPLATE_BANK.filter(t => t.source === "user").length;
    const total = TEMPLATE_BANK.length;
    return { userCount, total };
}

saveTemplateBtn.addEventListener("click", () => {

    if (!PIPELINE) recomputeAndRender();
    if (!PIPELINE) return;

    let sum = 0;
    for (let i = 0; i < PIPELINE.normalized.length; i++) sum += PIPELINE.normalized[i];
    if (sum < 1) {
        alert("Draw something first (it looks empty).");
        return;
    }

    const digit = Number(saveDigitEl.value);

    const vecCopy = new Float32Array(PIPELINE.normalized);

    TEMPLATE_BANK.push({
        digit,
        font: "user",
        vec: vecCopy,
        source: "user",
        createdAt: Date.now(),

    });

    saveUserTemplatesToLocalStorage();

    const { userCount, total } = countTemplates();
    alert(`Saved! User templates: ${userCount}. Total templates: ${total}.`);

    recomputeAndRender();
});


function clearPreview() {
    pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    pctx.fillStyle = "black";
    pctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
}

function recomputeAndRender() {
    const threshold = Number(thrEl.value);
    const margin = Number(marginEl.value);

    PIPELINE = preprocessPipeline(drawCanvas, { size: 28, threshold, margin: Math.min(12, margin) });
    if (!PIPELINE) return;

    PIPELINE.stages = PIPELINE.stages.filter(s => !s._extra);

    const bestT = bestTemplateForInput(PIPELINE.normalized);

    if (bestT) {
        const diff = diffVec(PIPELINE.normalized, bestT.vec);

        PIPELINE.stages.push({
            name: "Best template",
            info: `digit=${bestT.digit}`,
            kind: "imagedata",
            data: imageDataFrom28(bestT.vec, 28),
            _extra: true,
        });

        PIPELINE.stages.push({
            name: "Difference",
            info: "white = mismatch",
            kind: "imagedata",
            data: imageDataFrom28(diff, 28),
            _extra: true,
        });
    }

    stageIndex = Math.max(0, Math.min(stageIndex, PIPELINE.stages.length - 1));
    renderStage();

    render28ToPreview(PIPELINE.normalized, 28);

    const { best, perDigitTop } = matchAgainstTemplates(PIPELINE.normalized);
    resultEl.textContent = best ? String(best.digit) : "—";

    scoresEl.innerHTML = "";
    perDigitTop.slice(0, 5).forEach(s => {
        const li = document.createElement("li");
        li.textContent = `${s.digit} - ${s.score.toFixed(3)}`;
        scoresEl.appendChild(li);
    });
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

clearUserTemplatesBtn.addEventListener("click", () => {
    TEMPLATE_BANK = TEMPLATE_BANK.filter(t => t.source !== "user");
    saveUserTemplatesToLocalStorage();
    const { userCount, total } = countTemplates();
    alert(`Cleared. User templates: ${userCount}. Total templates: ${total}.`);
    recomputeAndRender();
});

drawCanvas.addEventListener("pointerdown", (e) => { drawCanvas.setPointerCapture(e.pointerId); onDown(e); });
drawCanvas.addEventListener("pointermove", onMove);
drawCanvas.addEventListener("pointerup", onUp);
drawCanvas.addEventListener("pointercancel", onUp);

clearBtn.addEventListener("click", clearDraw);


prevStageBtn.addEventListener("click", () => {
    if (!PIPELINE) return;
    stageIndex = (stageIndex - 1 + PIPELINE.stages.length) % PIPELINE.stages.length;
    renderStage();
});

nextStageBtn.addEventListener("click", () => {
    if (!PIPELINE) return;
    stageIndex = (stageIndex + 1) % PIPELINE.stages.length;
    renderStage();
});

function syncLabels() {
    brushValEl.textContent = brushSizeEl.value;
    thrValEl.textContent = thrEl.value;
    marginValEl.textContent = marginEl.value;
}

brushSizeEl.addEventListener("input", () => {
    syncLabels();
    setBrush();
    recomputeAndRender();
});

thrEl.addEventListener("input", () => {
    syncLabels();
    recomputeAndRender();
});

marginEl.addEventListener("input", () => {
    syncLabels();
    recomputeAndRender();
});

function preprocessTo28x28(canvas, size = 28) {
    const ctx = canvas.getContext("2d");
    const { width: W, height: H } = canvas;

    const imageData = ctx.getImageData(0, 0, W, H);
    const data = imageData.data;

    let minX = W, minY = H, maxX = -1, maxY = -1;

    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

            if (lum > 20) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX < 0) {
        return new Float32Array(size * size);
    }

    const margin = 10;
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(W - 1, maxX + margin);
    maxY = Math.min(H - 1, maxY + margin);

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cctx = cropCanvas.getContext("2d");
    cctx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    const side = Math.max(cropW, cropH);
    const squareCanvas = document.createElement("canvas");
    squareCanvas.width = side;
    squareCanvas.height = side;
    const sctx = squareCanvas.getContext("2d");

    sctx.fillStyle = "black";
    sctx.fillRect(0, 0, side, side);

    const dx = Math.floor((side - cropW) / 2);
    const dy = Math.floor((side - cropH) / 2);
    sctx.drawImage(cropCanvas, dx, dy);

    const outCanvas = document.createElement("canvas");
    outCanvas.width = size;
    outCanvas.height = size;
    const octx = outCanvas.getContext("2d");

    octx.fillStyle = "black";
    octx.fillRect(0, 0, size, size);
    octx.drawImage(squareCanvas, 0, 0, size, size);

    const out = octx.getImageData(0, 0, size, size).data;
    const arr = new Float32Array(size * size);

    for (let i = 0; i < size * size; i++) {
        const r = out[i * 4], g = out[i * 4 + 1], b = out[i * 4 + 2];
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        arr[i] = lum;
    }

    return arr;
}

function render28ToPreview(arr, size = 28) {
    const scale = Math.floor(previewCanvas.width / size);
    pctx.fillStyle = "black";
    pctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const v = arr[y * size + x];
            const c = Math.max(0, Math.min(255, Math.round(v * 255)));
            pctx.fillStyle = `rgb(${c},${c},${c})`;
            pctx.fillRect(x * scale, y * scale, scale, scale);
        }
    }
}

function buildTemplateBank(userTemplates = []) {
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

    return preprocessTo28x28(c, 28);
}

function normalizedCorrelation(a, b) {

    const n = a.length;

    let meanA = 0, meanB = 0;
    for (let i = 0; i < n; i++) { meanA += a[i]; meanB += b[i]; }
    meanA /= n; meanB /= n;

    let num = 0, denA = 0, denB = 0;
    for (let i = 0; i < n; i++) {
        const da = a[i] - meanA;
        const db = b[i] - meanB;
        num += da * db;
        denA += da * da;
        denB += db * db;
    }

    const denom = Math.sqrt(denA * denB);
    return denom === 0 ? -Infinity : (num / denom);
}

function matchAgainstTemplates(inputVec) {

    const scored = TEMPLATE_BANK.map(t => ({
        digit: t.digit,
        font: t.font,
        score: normalizedCorrelation(inputVec, t.vec),
    }));

    scored.sort((x, y) => y.score - x.score);

    const bestPerDigit = new Map();
    for (const s of scored) {
        if (!bestPerDigit.has(s.digit)) bestPerDigit.set(s.digit, s);
    }

    const perDigit = Array.from(bestPerDigit.values()).sort((x, y) => y.score - x.score);

    return {
        best: perDigit[0],
        perDigitTop: perDigit,
        bestTemplates: scored,
    };
}

function preprocessPipeline(canvas, opts = {}) {
    const size = opts.size ?? 28;
    const threshold = opts.threshold ?? 20;
    const margin = opts.margin ?? 10;

    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    const raw = ctx.getImageData(0, 0, W, H);

    const gray = new ImageData(W, H);
    for (let i = 0; i < W * H; i++) {
        const r = raw.data[i * 4];
        const g = raw.data[i * 4 + 1];
        const b = raw.data[i * 4 + 2];
        const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
        gray.data[i * 4] = lum;
        gray.data[i * 4 + 1] = lum;
        gray.data[i * 4 + 2] = lum;
        gray.data[i * 4 + 3] = 255;
    }

    const bin = new ImageData(W, H);
    let minX = W, minY = H, maxX = -1, maxY = -1;

    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const lum = gray.data[i];
            const v = lum > threshold ? 255 : 0;

            bin.data[i] = v;
            bin.data[i + 1] = v;
            bin.data[i + 2] = v;
            bin.data[i + 3] = 255;

            if (v === 255) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX < 0) {
        const normalized = new Float32Array(size * size);
        return {
            bbox: null,
            normalized,
            stages: [
                { name: "Raw", info: `${W}x${H}`, kind: "imagedata", data: raw },
                { name: "Grayscale", info: `${W}x${H}`, kind: "imagedata", data: gray },
                { name: "Threshold", info: `${W}x${H}  (t=${threshold})`, kind: "imagedata", data: bin },
                { name: "Resized", info: `${size}x${size}`, kind: "imagedata", data: imageDataFrom28(normalized, size) },
            ],
        };
    }

    const bbox = {
        minX: Math.max(0, minX - margin),
        minY: Math.max(0, minY - margin),
        maxX: Math.min(W - 1, maxX + margin),
        maxY: Math.min(H - 1, maxY + margin),
    };

    const cropW = bbox.maxX - bbox.minX + 1;
    const cropH = bbox.maxY - bbox.minY + 1;

    const crop = new ImageData(cropW, cropH);
    for (let y = 0; y < cropH; y++) {
        for (let x = 0; x < cropW; x++) {
            const srcI = ((bbox.minY + y) * W + (bbox.minX + x)) * 4;
            const dstI = (y * cropW + x) * 4;
            crop.data[dstI] = bin.data[srcI];
            crop.data[dstI + 1] = bin.data[srcI + 1];
            crop.data[dstI + 2] = bin.data[srcI + 2];
            crop.data[dstI + 3] = 255;
        }
    }

    const side = Math.max(cropW, cropH);
    const square = new ImageData(side, side);

    for (let i = 0; i < side * side; i++) {
        square.data[i * 4] = 0;
        square.data[i * 4 + 1] = 0;
        square.data[i * 4 + 2] = 0;
        square.data[i * 4 + 3] = 255;
    }
    const dx = Math.floor((side - cropW) / 2);
    const dy = Math.floor((side - cropH) / 2);
    for (let y = 0; y < cropH; y++) {
        for (let x = 0; x < cropW; x++) {
            const srcI = (y * cropW + x) * 4;
            const dstI = ((dy + y) * side + (dx + x)) * 4;
            square.data[dstI] = crop.data[srcI];
            square.data[dstI + 1] = crop.data[srcI + 1];
            square.data[dstI + 2] = crop.data[srcI + 2];
            square.data[dstI + 3] = 255;
        }
    }

    const tmpC = document.createElement("canvas");
    tmpC.width = side;
    tmpC.height = side;
    const tctx = tmpC.getContext("2d");
    tctx.putImageData(square, 0, 0);

    const outC = document.createElement("canvas");
    outC.width = size;
    outC.height = size;
    const octx = outC.getContext("2d");
    octx.fillStyle = "black";
    octx.fillRect(0, 0, size, size);
    octx.drawImage(tmpC, 0, 0, size, size);

    const resized = octx.getImageData(0, 0, size, size);

    const normalized = new Float32Array(size * size);

    const postThr = 128;

    for (let i = 0; i < size * size; i++) {
        const v = resized.data[i * 4];
        normalized[i] = v > postThr ? 1 : 0;
    }


    for (let i = 0; i < size * size; i++) {
        const vv = normalized[i] ? 255 : 0;
        resized.data[i * 4] = vv;
        resized.data[i * 4 + 1] = vv;
        resized.data[i * 4 + 2] = vv;
        resized.data[i * 4 + 3] = 255;
    }

    const stages = [
        { name: "Raw", info: `${W}x${H}`, kind: "imagedata", data: raw },
        { name: "Grayscale", info: `${W}x${H}`, kind: "imagedata", data: gray },
        { name: "Threshold", info: `${W}x${H}`, kind: "imagedata", data: bin, bbox },
        { name: "Crop", info: `${cropW}x${cropH}`, kind: "imagedata", data: crop },
        { name: "Square pad", info: `${side}x${side}`, kind: "imagedata", data: square },
        { name: "Resized", info: `${size}x${size}`, kind: "imagedata", data: resized },
    ];

    return { bbox, normalized, stages };
}

function renderStage() {
    if (!PIPELINE) return;

    const stage = PIPELINE.stages[stageIndex];
    stageNameEl.textContent = `${stageIndex + 1}/${PIPELINE.stages.length}: ${stage.name}`;
    stageInfoEl.textContent = stage.info ?? "—";

    svctx.fillStyle = "black";
    svctx.fillRect(0, 0, stageCanvas.width, stageCanvas.height);

    if (stage.kind === "imagedata") {
        drawImageDataFit(svctx, stage.data, stageCanvas.width, stageCanvas.height);

        if (stage.bbox) {
            const { minX, minY, maxX, maxY } = stage.bbox;

            const fit = getFitRect(stage.data.width, stage.data.height, stageCanvas.width, stageCanvas.height);
            const sx = fit.x + (minX / stage.data.width) * fit.w;
            const sy = fit.y + (minY / stage.data.height) * fit.h;
            const sw = ((maxX - minX + 1) / stage.data.width) * fit.w;
            const sh = ((maxY - minY + 1) / stage.data.height) * fit.h;

            svctx.strokeStyle = "lime";
            svctx.lineWidth = 3;
            svctx.strokeRect(sx, sy, sw, sh);
        }
    }
}

function drawImageDataFit(ctx, imageData, viewW, viewH) {
    const off = document.createElement("canvas");
    off.width = imageData.width;
    off.height = imageData.height;
    off.getContext("2d").putImageData(imageData, 0, 0);

    const fit = getFitRect(imageData.width, imageData.height, viewW, viewH);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, fit.x, fit.y, fit.w, fit.h);
}

function getFitRect(srcW, srcH, dstW, dstH) {
    const s = Math.min(dstW / srcW, dstH / srcH);
    const w = Math.floor(srcW * s);
    const h = Math.floor(srcH * s);
    const x = Math.floor((dstW - w) / 2);
    const y = Math.floor((dstH - h) / 2);
    return { x, y, w, h };
}

function imageDataFrom28(vec, size) {
    const img = new ImageData(size, size);
    for (let i = 0; i < size * size; i++) {
        const v = Math.max(0, Math.min(255, Math.round(vec[i] * 255)));
        img.data[i * 4] = v;
        img.data[i * 4 + 1] = v;
        img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
    }
    return img;
}

function bestTemplateForInput(inputVec) {

    let best = null;
    for (const t of TEMPLATE_BANK) {
        const score = normalizedCorrelation(inputVec, t.vec);
        if (!best || score > best.score) best = { ...t, score };
    }
    return best;
}

function diffVec(a, b) {
    const n = a.length;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.abs(a[i] - b[i]);
    return out;
}



function getUserTemplates() {
    return TEMPLATE_BANK.filter(t => t.source === "user");
}

function saveUserTemplatesToLocalStorage() {
    const user = getUserTemplates().map(t => ({
        digit: t.digit,
        vec: Array.from(t.vec),
        createdAt: t.createdAt ?? Date.now(),
    }));
    localStorage.setItem(LS_KEY, JSON.stringify(user));
}

function loadUserTemplatesFromLocalStorage() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return 0;

    let arr;
    try {
        arr = JSON.parse(raw);
    } catch {
        return 0;
    }

    if (!Array.isArray(arr)) return 0;

    let added = 0;
    for (const item of arr) {
        if (typeof item?.digit !== "number") continue;
        if (!Array.isArray(item?.vec) || item.vec.length !== 28 * 28) continue;

        TEMPLATE_BANK.push({
            digit: item.digit,
            font: "user",
            vec: new Float32Array(item.vec),
            source: "user",
            createdAt: item.createdAt ?? Date.now(),
        });
        added++;
    }
    return added;
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
    const userTemplates = await loadUserTemplatesFromJson();

    TEMPLATE_BANK = buildTemplateBank(userTemplates);

    console.log("Template bank:", TEMPLATE_BANK.length);
    console.log("Loaded user templates from JSON:", userTemplates.length);

    syncLabels();
    setBrush();
    clearDraw();
}

exportTemplatesBtn.addEventListener("click", () => {
    const user = getUserTemplates().map(t => ({
        digit: t.digit,
        vec: Array.from(t.vec),
        createdAt: t.createdAt ?? Date.now(),
    }));

    const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        templates: user,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "ocr-user-templates.json";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
});

importTemplatesBtn.addEventListener("click", () => {
    importFileEl.value = "";
    importFileEl.click();
});

importFileEl.addEventListener("change", async () => {
    const file = importFileEl.files?.[0];
    if (!file) return;

    let text;
    try {
        text = await file.text();
    } catch {
        alert("Could not read file.");
        return;
    }

    let json;
    try {
        json = JSON.parse(text);
    } catch {
        alert("Invalid JSON.");
        return;
    }

    const templates = json?.templates;
    if (!Array.isArray(templates)) {
        alert("JSON format not recognized (missing templates array).");
        return;
    }

    let added = 0;
    for (const item of templates) {
        if (typeof item?.digit !== "number") continue;
        if (!Array.isArray(item?.vec) || item.vec.length !== 28 * 28) continue;

        TEMPLATE_BANK.push({
            digit: item.digit,
            font: "user",
            vec: new Float32Array(item.vec),
            source: "user",
            createdAt: item.createdAt ?? Date.now(),
        });
        added++;
    }

    saveUserTemplatesToLocalStorage();
    recomputeAndRender();
    alert(`Imported ${added} templates.`);
});

init();