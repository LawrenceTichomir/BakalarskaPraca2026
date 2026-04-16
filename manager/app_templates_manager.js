const LS_KEY = "ocr_template_lab_user_templates_v1";

const reloadBtn = document.getElementById("reloadBtn");
const exportBtn = document.getElementById("exportBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const summaryEl = document.getElementById("summary");
const templatesGridEl = document.getElementById("templatesGrid");

function loadUserTemplatesFromLocalStorage() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return [];

  let arr;
  try {
    arr = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(arr)) return [];

  return arr.filter(item =>
    typeof item?.digit === "number" &&
    Array.isArray(item?.vec) &&
    item.vec.length === 28 * 28
  );
}

function saveUserTemplatesToLocalStorage(templates) {
  localStorage.setItem(LS_KEY, JSON.stringify(templates));
}

function renderVecToCanvas(canvas, vec, size = 28) {
  const ctx = canvas.getContext("2d");
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

function formatDate(ts) {
  if (!ts) return "unknown";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toLocaleString();
}

function exportTemplates(templates) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    templates
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "user_templates.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function deleteTemplateAt(index) {
  const templates = loadUserTemplatesFromLocalStorage();
  templates.splice(index, 1);
  saveUserTemplatesToLocalStorage(templates);
  renderTemplatesManager();
}

function clearAllTemplates() {
  saveUserTemplatesToLocalStorage([]);
  renderTemplatesManager();
}

function renderTemplatesManager() {
  const templates = loadUserTemplatesFromLocalStorage();

  summaryEl.textContent = `Loaded templates: ${templates.length}`;
  templatesGridEl.innerHTML = "";

  if (templates.length === 0) {
    const empty = document.createElement("div");
    empty.className = "emptyState";
    empty.textContent = "No user templates found in localStorage.";
    templatesGridEl.appendChild(empty);
    return;
  }

  templates.forEach((tpl, index) => {
    const card = document.createElement("article");
    card.className = "card";

    const header = document.createElement("div");
    header.className = "cardHeader";

    const badge = document.createElement("div");
    badge.className = "digitBadge";
    badge.textContent = `Digit ${tpl.digit}`;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `#${index + 1}`;

    header.appendChild(badge);
    header.appendChild(meta);

    const canvas = document.createElement("canvas");
    canvas.className = "templateCanvas";
    canvas.width = 140;
    canvas.height = 140;

    renderVecToCanvas(canvas, tpl.vec, 28);

    const info = document.createElement("div");
    info.className = "meta";
    info.textContent = `Created: ${formatDate(tpl.createdAt)}`;

    const footer = document.createElement("div");
    footer.className = "cardFooter";

    const indexInfo = document.createElement("div");
    indexInfo.className = "meta";
    indexInfo.textContent = "User template";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "deleteBtn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      deleteTemplateAt(index);
    });

    footer.appendChild(indexInfo);
    footer.appendChild(deleteBtn);

    card.appendChild(header);
    card.appendChild(canvas);
    card.appendChild(info);
    card.appendChild(footer);

    templatesGridEl.appendChild(card);
  });
}

reloadBtn.addEventListener("click", renderTemplatesManager);

exportBtn.addEventListener("click", () => {
  const templates = loadUserTemplatesFromLocalStorage();
  exportTemplates(templates);
});

clearAllBtn.addEventListener("click", () => {
  const ok = confirm("Delete all user templates from localStorage?");
  if (!ok) return;
  clearAllTemplates();
});

renderTemplatesManager();