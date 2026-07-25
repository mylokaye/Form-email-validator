(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────
  const MAX_INPUT_SIZE = 500 * 1024; // 500KB — prevent browser freeze on large HTML
  const DEBOUNCE_MS = 300; // ms delay before refreshing previews after typing stops

const textTags = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"]);
const unsupportedTags = new Set(["form", "script", "iframe", "video", "audio", "canvas", "object", "embed", "select", "textarea"]);
const buttonTerms = ["read more", "view", "shop", "buy", "learn more", "details", "report", "briefing", "kit"];
const supportedEditorBlockTypes = new Set(["Text", "Image", "Button"]);

// ── Debounce utility ──────────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ── State ─────────────────────────────────────────────────────
const state = {
  analysis: {},
  conversion: {},
  validation: {},
  warnings: []
};

const els = {
  originalHtmlTab: document.getElementById("originalHtmlTab"),
  convertedHtmlTab: document.getElementById("convertedHtmlTab"),
  originalHtml: document.getElementById("originalHtml"),
  convertedHtml: document.getElementById("convertedHtml"),
  originalPreviewTab: document.getElementById("originalPreviewTab"),
  convertedPreviewTab: document.getElementById("convertedPreviewTab"),
  copyButton: document.getElementById("copyButton"),
  refreshButton: document.getElementById("refreshButton"),
  statusText: document.getElementById("statusText"),
  summaryRows: document.getElementById("summaryRows"),
  originalPreview: document.getElementById("originalPreview"),
  convertedPreview: document.getElementById("convertedPreview"),
  malformedBadge: document.getElementById("malformedBadge"),
  errorBox: document.getElementById("errorBox"),
  summaryTab: document.getElementById("summaryTab"),
  warningsTab: document.getElementById("warningsTab"),
  summaryPanel: document.getElementById("summaryPanel"),
  warningsPanel: document.getElementById("warningsPanel"),
  warningCount: document.getElementById("warningCount"),
};

document.querySelectorAll(".pipeline-button").forEach((button) => {
  button.className = "flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-accent bg-accent px-4 text-sm font-bold text-[#061014] shadow-control transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-slate-500 disabled:shadow-none";
  button.addEventListener("click", () => runPipeline());
});

els.copyButton.addEventListener("click", copyConvertedHtml);
els.refreshButton.addEventListener("click", refreshPreviews);
els.originalHtmlTab.addEventListener("click", () => setActiveOriginalView("html"));
els.originalPreviewTab.addEventListener("click", () => setActiveOriginalView("preview"));
els.convertedHtmlTab.addEventListener("click", () => setActiveConvertedView("html"));
els.convertedPreviewTab.addEventListener("click", () => setActiveConvertedView("preview"));
els.summaryTab.addEventListener("click", () => setActiveDetails("summary"));
els.warningsTab.addEventListener("click", () => setActiveDetails("warnings"));
els.originalHtml.addEventListener("input", debounce(() => {
  clearError();
  refreshPreviews();
}, DEBOUNCE_MS));
els.convertedHtml.addEventListener("input", debounce(() => {
  clearError();
  refreshPreviews();
}, DEBOUNCE_MS));

function init() {
  renderSummary();
  setActiveOriginalView("html");
  setActiveConvertedView("html");
  setActiveDetails("summary");
  refreshPreviews();
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function runPipeline() {
  clearError();
  const original = els.originalHtml.value;

  if (!original.trim()) {
    showError("Paste, upload, or load original HTML first.");
    return;
  }

  // Enforce input size limit to prevent browser freeze
  if (original.length > MAX_INPUT_SIZE) {
    showError(`Input HTML too large (${(original.length / 1024).toFixed(0)} KB). Maximum is ${MAX_INPUT_SIZE / 1024} KB.`);
    return;
  }

  setStatus('Running conversion...');
  const errors = [];

  try {
    try {
      state.analysis = analyseEmailHtml(original);
    } catch (e) {
      errors.push(`Analysis failed: ${e.message}`);
      console.error('Analysis error:', e);
      state.analysis = {};
    }
    try {
      state.conversion = convertEmailHtml(original);
      els.convertedHtml.value = state.conversion.convertedHtml;
    } catch (e) {
      errors.push(`Conversion failed: ${e.message}`);
      console.error('Conversion error:', e);
      state.conversion = { convertedHtml: original, warnings: [], summary: { converted: false, skipped: 1 } };
    }
    try {
      state.validation = validateConvertedHtml(original, state.conversion.convertedHtml, state.conversion);
    } catch (e) {
      errors.push(`Validation failed: ${e.message}`);
      console.error('Validation error:', e);
    }
    setActiveConvertedView('html');

    if (errors.length) {
      showError(errors.join(' '));
    }
    syncWarnings();
    renderSummary();
    renderWarnings();
    refreshPreviews();
  } catch (error) {
    console.error("Pipeline error:", error);
    showError(error.message || "Pipeline failed.");
  } finally {
    setStatus("");
  }
}

function analyseEmailHtml(html) {
  const doc = parseHtml(html);
  return analyseEmailDocument(html, doc);
}

function analyseEmailDocument(html, doc) {
  const nodes = collectNodes(doc);
  const warnings = [];

  scanRawHtmlWarnings(html, warnings);
  detectOutlookWarnings(html, doc, warnings);
  detectUnsupportedWarnings(nodes, warnings);

  const maxDepth = Math.max(0, ...nodes.map(tableDepth));
  if (maxDepth >= 4) {
    warnings.push(issue("deep-nesting", "warning", `Maximum nested table depth is ${maxDepth}; avoid structural rewrites.`));
  }

  return {
    textBlocks: detectTextBlocks(nodes),
    imageBlocks: detectImageBlocks(nodes),
    buttonBlocks: detectButtonBlocks(nodes),
    warnings: dedupeWarnings(warnings)
  };
}

function convertEmailHtml(html) {
  const doc = parseHtml(html);
  const conversionAnalysis = analyseEmailDocument(html, doc);
  const warningTypes = new Set((conversionAnalysis.warnings || []).map((warning) => warning.type));
  const summary = {
    converted: true,
    designerMetaAdded: 0,
    containersAdded: 0,
    textBlocksMarked: 0,
    imageBlocksMarked: 0,
    buttonBlocksMarked: 0,
    skipped: 0
  };
  const warnings = [...(conversionAnalysis.warnings || [])];

  if (warningTypes.has("malformed-html")) {
    summary.converted = false;
    summary.skipped += 1;
    warnings.push(issue("conversion-skipped", "warning", "Malformed HTML detected; returned original HTML without conversion."));
    return finalizeConversionResult(html, warnings, summary);
  }

  if (warningTypes.has("outlook-specific-code") && !canConvertWithOutlookCode(doc)) {
    summary.converted = false;
    summary.skipped += 1;
    warnings.push(issue("conversion-skipped", "warning", "Outlook/VML-specific code detected; returned original HTML without conversion."));
    return finalizeConversionResult(html, warnings, summary);
  }

  (conversionAnalysis.buttonBlocks || []).forEach((block) => {
    if (!block.element || hasEditorBlockContext(block.element)) {
      return;
    }
    wrapElement(block.element, "div", { "data-editorblocktype": "Button" });
    summary.buttonBlocksMarked += 1;
    warnings.push(issue("button-block-review", "info", "Styled link marked as a Dynamics Button; verify its third-party HTML and styles in the Designer.", block));
  });

  (conversionAnalysis.textBlocks || []).forEach((block) => {
    const element = block.element;
    if (!element || !block.safeCandidate || block.insideExistingDynamicsBlock || hasEditorBlockContext(element)) {
      return;
    }
    wrapElement(element, "div", { "data-editorblocktype": "Text" });
    summary.textBlocksMarked += 1;
  });

  (conversionAnalysis.imageBlocks || []).forEach((block) => {
    const element = block.element;
    if (!element || block.insideExistingDynamicsBlock || hasEditorBlockContext(element) || hasStripoButtonContext(element)) {
      return;
    }
    const target = element.parentElement && element.parentElement.tagName.toLowerCase() === "a" ? element.parentElement : element;
    if (hasEditorBlockContext(target) || hasStripoButtonContext(target)) {
      return;
    }
    wrapElement(target, "div", { "data-editorblocktype": "Image" });
    summary.imageBlocksMarked += 1;
  });

  ensureEditorBlocksHaveContainers(doc, summary);
  ensureDesignerDocumentMeta(doc, summary);

  return finalizeConversionResult(serializeDoc(doc), warnings, summary);
}

function finalizeConversionResult(convertedHtml, warnings, summary) {
  summary.outputCounts = conversionMarkerSummary(convertedHtml);
  if (summary.converted !== false) {
    const hasRequiredMarkers = summary.outputCounts.containerCount > 0 && summary.outputCounts.editorBlockCount > 0;
    summary.converted = hasRequiredMarkers;
    if (!hasRequiredMarkers) {
      warnings.push(issue("conversion-incomplete", "error", "Conversion completed without required Dynamics container and editor block markers."));
    }
  }
  return {
    convertedHtml,
    warnings: dedupeWarnings(warnings),
    summary
  };
}

function conversionMarkerSummary(html) {
  const doc = parseHtml(html);
  const editorBlocks = [...doc.querySelectorAll("[data-editorblocktype]")]
    .filter((element) => supportedEditorBlockTypes.has(element.getAttribute("data-editorblocktype")));
  return {
    containerCount: doc.querySelectorAll('[data-container="true"]').length,
    editorBlockCount: editorBlocks.length,
    textBlocks: doc.querySelectorAll('[data-editorblocktype="Text"]').length,
    imageBlocks: doc.querySelectorAll('[data-editorblocktype="Image"]').length,
    buttonBlocks: doc.querySelectorAll('[data-editorblocktype="Button"]').length,
    hasDesignerMeta: hasDesignerDocumentMetaDoc(doc)
  };
}

function validateConvertedHtml(originalHtml, convertedHtml, conversion = {}) {
  const warnings = [];
  const errors = [];
  const markerSummary = conversion.summary?.outputCounts || conversionMarkerSummary(convertedHtml);
  const requiresDynamicsMarkers = hasConvertibleRegions(originalHtml);

  if (!convertedHtml.trim()) {
    errors.push(issue("empty-converted-output", "error", "Converted output is empty."));
  }
  if (conversion.summary?.converted === false && requiresDynamicsMarkers) {
    errors.push(issue("conversion-not-applied", "error", "Conversion did not inject the required Dynamics markers."));
  }
  if (requiresDynamicsMarkers && markerSummary.containerCount === 0) {
    errors.push(issue("missing-container", "error", "Converted output has editable regions but no Dynamics container marker."));
  }
  if (requiresDynamicsMarkers && markerSummary.editorBlockCount === 0) {
    errors.push(issue("missing-editor-blocks", "error", "Converted output has editable regions but no Dynamics editor block markers."));
  }
  if (markerSummary.containerCount > 0 && !hasDesignerDocumentMeta(convertedHtml)) {
    errors.push(issue("missing-designer-meta", "error", "Converted output has Dynamics containers but no designer document meta tag."));
  }
  const originalSnippets = visibleText(originalHtml).split(" ").filter(Boolean).slice(0, 18).join(" ");
  if (originalSnippets && !visibleText(convertedHtml).toLowerCase().includes(originalSnippets.toLowerCase().slice(0, 80))) {
    warnings.push(issue("content-preservation-review", "warning", "Converted output may be missing visible source content; review manually."));
  }
  parseHtml(convertedHtml).querySelectorAll("[data-editorblocktype]").forEach((element) => {
    const type = element.getAttribute("data-editorblocktype");
    if (!supportedEditorBlockTypes.has(type)) {
      warnings.push(issue("unknown-editorblocktype", "warning", `Unknown editor block type: ${type}.`));
    }
  });
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      originalLength: originalHtml.length,
      convertedLength: convertedHtml.length,
      containerCount: markerSummary.containerCount,
      editorBlockCount: markerSummary.editorBlockCount
    }
  };
}

function detectTextBlocks(nodes) {
  return nodes
    .filter((node) => textTags.has(node.tag))
    .filter((node) => node.text.length >= 12 || hasStripoTextBlockContext(node.element))
    .map((node) => ({
      id: node.id,
      tag: node.tag,
      path: node.path,
      line: node.line,
      tableDepth: tableDepth(node.element),
      textPreview: preview(node.text),
      insideExistingDynamicsBlock: Boolean(node.element.closest("[data-editorblocktype]")),
      safeCandidate: !node.element.querySelector("table") && !hasVmlContext(node.element),
      element: node.element,
      reason: "Simple text element that may map to a future Text block."
    }));
}

function detectImageBlocks(nodes) {
  return nodes
    .filter((node) => node.tag === "img")
    .map((node) => {
      const link = node.element.closest("a");
      return {
        id: node.id,
        tag: node.tag,
        path: node.path,
        line: node.line,
        tableDepth: tableDepth(node.element),
        src: node.element.getAttribute("src") || "",
        alt: node.element.getAttribute("alt") || "",
        width: node.element.getAttribute("width") || "",
        height: node.element.getAttribute("height") || "",
        linked: Boolean(link),
        href: link ? link.getAttribute("href") || "" : "",
        insideExistingDynamicsBlock: Boolean(node.element.closest("[data-editorblocktype]")),
        element: node.element,
        reason: "Image element that may map to a future Image block if structurally simple."
      };
    });
}

function detectButtonBlocks(nodes) {
  return nodes
    .filter((node) => node.tag === "a" && looksLikeButtonLink(node.element))
    .map((node) => ({
      id: node.id,
      tag: node.tag,
      path: node.path,
      line: node.line,
      tableDepth: tableDepth(node.element),
      href: node.element.getAttribute("href") || "",
      textPreview: preview(node.text),
      styleSignals: buttonStyleSignals(node.element),
      insideExistingDynamicsBlock: Boolean(node.element.closest("[data-editorblocktype]")),
      element: node.element,
      reason: "CTA-like link; preserve by default unless a verified Dynamics button block exists."
    }));
}

function parseHtml(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  // Check for parser error document (malformed HTML produces a <parsererror> element)
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    const message = parserError.textContent || "Unknown parse error";
    throw new Error(`HTML parse error: ${message.trim().split("\n")[0]}`);
  }
  return doc;
}

function serializeDoc(doc) {
  const doctype = doc.doctype ? `<!doctype ${doc.doctype.name}>` : "<!doctype html>";
  return `${doctype}\n${doc.documentElement.outerHTML}`;
}

function collectNodes(doc) {
  let nextId = 1;
  const result = [];
  const siblingIndex = new WeakMap();

  function walk(element, parentPath) {
    const tag = element.tagName.toLowerCase();
    const parent = element.parentElement;
    const key = parent || doc;
    const counts = siblingIndex.get(key) || {};
    counts[tag] = (counts[tag] || 0) + 1;
    siblingIndex.set(key, counts);
    const path = parentPath ? `${parentPath} > ${tag}[${counts[tag]}]` : `${tag}[${counts[tag]}]`;
    element.dataset.staticNodeId = `n${nextId}`;
    result.push({
      id: `n${nextId}`,
      tag,
      path,
      text: normalizeText(element.textContent || ""),
      element
    });
    nextId += 1;
    [...element.children].forEach((child) => walk(child, path));
  }

  try {
    if (doc.documentElement) {
      walk(doc.documentElement, "");
    }
  } finally {
    // Always clean up temporary attributes, even if walk() threw
    result.forEach((node) => node.element.removeAttribute("data-static-node-id"));
  }
  return result;
}

function scanRawHtmlWarnings(html, warnings) {
  const tags = [];
  for (let start = 0; start < html.length; start += 1) {
    if (html[start] !== "<" || !/[a-z]/i.test(html[start + 1] || "")) {
      continue;
    }

    let quote = "";
    let end = start + 1;
    for (; end < html.length; end += 1) {
      const char = html[end];
      if ((char === '"' || char === "'") && (!quote || quote === char)) {
        quote = quote ? "" : char;
      } else if (char === ">" && !quote) {
        end += 1;
        break;
      }
    }
    tags.push(html.slice(start, end));
    start = end - 1;
  }

  tags.forEach((tag) => {
    const doubleQuotes = (tag.match(/"/g) || []).length;
    const singleQuotes = (tag.match(/'/g) || []).length;
    if (doubleQuotes % 2 || singleQuotes % 2) {
      warnings.push(issue("malformed-html", "warning", "Tag appears to contain an unbalanced quote."));
    }
  });
}

function detectOutlookWarnings(html, doc, warnings) {
  if (/\[if\s|<!\[endif\]|mso/i.test(html)) {
    warnings.push(issue("outlook-specific-code", "warning", "Outlook conditional comment detected; preserve paired branches."));
  }
  if (/<\/?(v:|o:|w:)|xmlns:(v|o|w)=/i.test(html)) {
    warnings.push(issue("outlook-specific-code", "warning", "VML or Office-specific element detected; do not rewrite automatically."));
  }
  doc.querySelectorAll("*").forEach((element) => {
    if ([...element.attributes].some((attr) => attr.name.startsWith("xmlns:") && attr.value.startsWith("urn:schemas-microsoft-com"))) {
      warnings.push(issue("outlook-specific-code", "warning", `Office namespace detected on <${element.tagName.toLowerCase()}>.`));
    }
  });
}

function detectUnsupportedWarnings(nodes, warnings) {
  nodes.forEach((node) => {
    if (unsupportedTags.has(node.tag)) {
      warnings.push(issue("unsupported-structure", "warning", `Unsupported <${node.tag}> structure detected; preserve or require manual review.`, node));
    }
    if (node.tag === "picture" || node.element.hasAttribute("srcset")) {
      warnings.push(issue("unsupported-structure", "warning", "Responsive image structure detected; avoid automatic Image block conversion.", node));
    }
  });
}

function looksLikeButtonLink(element) {
  const styleSignals = buttonStyleSignals(element);
  const text = normalizeText(element.textContent || "").toLowerCase();
  const classes = classList(element).join(" ");
  const termSignal = buttonTerms.some((term) => text.includes(term));
  const classSignal = classes.includes("button") || classes.includes("btn") || classes.includes("cta");
  const stripoSignal = hasStripoButtonContext(element);
  return (Boolean(element.getAttribute("href")) || stripoSignal) && (styleSignals.length > 0 || termSignal || classSignal || stripoSignal);
}

function buttonStyleSignals(element) {
  const style = (element.getAttribute("style") || "").toLowerCase();
  const signals = [];
  ["background", "padding", "border-radius", "display:inline-block"].forEach((name) => {
    if (style.includes(name)) {
      signals.push(name);
    }
  });
  if (hasStripoButtonContext(element)) {
    signals.push("stripo-button");
  }
  return signals;
}

function hasStripoTextBlockContext(element) {
  for (let current = element; current; current = current.parentElement) {
    const classes = classList(current);
    if (classes.includes("esd-block-text") || classes.some((name) => name.startsWith("es-text-"))) {
      return true;
    }
  }
  return false;
}

function hasStripoButtonContext(element) {
  for (let current = element; current; current = current.parentElement) {
    const classes = classList(current);
    if (classes.includes("esd-block-button") || classes.includes("es-button") || classes.includes("es-button-border") || (classes.includes("msohide") && current.tagName.toLowerCase() === "span")) {
      return true;
    }
  }
  return false;
}

function hasStripoMarkup(doc) {
  return [...doc.querySelectorAll("[class]")].some((element) => classList(element).some((name) => name.startsWith("esd-") || name.startsWith("es-") || name === "msohide"));
}

function hasExistingDynamicsMarkup(doc) {
  return Boolean(doc.querySelector("[data-container='true'], [data-editorblocktype]"));
}

function canConvertWithOutlookCode(doc) {
  return hasExistingDynamicsMarkup(doc) || hasStripoMarkup(doc);
}

function hasEditorBlockContext(element) {
  return Boolean(element.closest("[data-editorblocktype]"));
}

function hasVmlContext(element) {
  return Boolean(element.closest("v\\:roundrect, v\\:rect, v\\:shape"));
}

function wrapElement(element, wrapperTag, attrs) {
  const doc = element.ownerDocument;
  const wrapper = doc.createElement(wrapperTag);
  Object.entries(attrs).forEach(([key, value]) => wrapper.setAttribute(key, value));
  element.parentNode.insertBefore(wrapper, element);
  wrapper.appendChild(element);
  return wrapper;
}

function ensureEditorBlocksHaveContainers(doc, summary) {
  doc.querySelectorAll('[data-editorblocktype="Text"], [data-editorblocktype="Image"]').forEach((block) => {
    if (block.closest('[data-container="true"]')) {
      return;
    }
    wrapElement(block, "div", { "data-container": "true" });
    summary.containersAdded += 1;
  });
}

function ensureDesignerDocumentMeta(doc, summary) {
  const hasDynamicsMarkers = Boolean(doc.querySelector('[data-container="true"], [data-editorblocktype]'));
  if (!hasDynamicsMarkers || hasDesignerDocumentMetaDoc(doc)) {
    return;
  }
  const head = doc.head || doc.documentElement.insertBefore(doc.createElement("head"), doc.body || null);
  const meta = doc.createElement("meta");
  meta.setAttribute("type", "xrm/designer/setting");
  meta.setAttribute("name", "type");
  meta.setAttribute("value", "marketing-designer-content-editor-document");
  head.insertBefore(meta, head.firstChild);
  summary.designerMetaAdded += 1;
}

function hasDesignerDocumentMeta(html) {
  return hasDesignerDocumentMetaDoc(parseHtml(html));
}

function hasDesignerDocumentMetaDoc(doc) {
  return Boolean(doc.querySelector('meta[type="xrm/designer/setting"][name="type"][value="marketing-designer-content-editor-document"]'));
}

function tableDepth(element) {
  let depth = 0;
  for (let current = element; current; current = current.parentElement) {
    if (current.tagName && current.tagName.toLowerCase() === "table") {
      depth += 1;
    }
  }
  return depth;
}

function hasConvertibleRegions(html) {
  const analysis = analyseEmailHtml(html);
  return analysis.textBlocks.length > 0 || analysis.imageBlocks.length > 0 || analysis.buttonBlocks.length > 0;
}

function visibleText(html) {
  const doc = parseHtml(html);
  doc.querySelectorAll("script, style, noscript").forEach((element) => element.remove());
  return normalizeText(doc.body ? doc.body.textContent || "" : doc.textContent || "");
}

function classList(element) {
  return (element.getAttribute("class") || "").toLowerCase().split(/\s+/).filter(Boolean);
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function preview(value, limit = 120) {
  const text = normalizeText(value || "");
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}...`;
}

function issue(type, severity, message, extra = {}) {
  const result = { type, severity, message };
  if (extra.path) result.path = extra.path;
  if (extra.line) result.line = extra.line;
  if (extra.id) result.nodeId = extra.id;
  return result;
}

function dedupeWarnings(warnings) {
  const seen = new Set();
  return warnings.filter((warning) => {
    const key = [warning.type, warning.message, warning.path, warning.line].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function resetPipelineState() {
  state.analysis = {};
  state.conversion = {};
  state.validation = {};
  state.warnings = [];
  renderSummary();
  renderWarnings();
}

function setActiveOriginalView(view) {
  const isHtml = view === "html";
  els.originalHtml.classList.toggle("hidden", !isHtml);
  els.originalPreview.classList.toggle("hidden", isHtml);
  setTabState(els.originalHtmlTab, isHtml);
  setTabState(els.originalPreviewTab, !isHtml);
}

function setActiveConvertedView(view) {
  const isHtml = view === "html";
  els.convertedHtml.classList.toggle("hidden", !isHtml);
  els.convertedPreview.classList.toggle("hidden", isHtml);
  setTabState(els.convertedHtmlTab, isHtml);
  setTabState(els.convertedPreviewTab, !isHtml);
}

function setActiveDetails(tabName) {
  const isSummary = tabName === "summary";
  els.summaryPanel.classList.toggle("hidden", !isSummary);
  els.warningsPanel.classList.toggle("hidden", isSummary);
  setTabState(els.summaryTab, isSummary);
  setTabState(els.warningsTab, !isSummary);
}

function setTabState(tab, active) {
  tab.classList.toggle("bg-white/10", active);
  tab.classList.toggle("text-white", active);
  tab.classList.toggle("shadow-sm", active);
  tab.classList.toggle("ring-1", active);
  tab.classList.toggle("ring-white/15", active);
  tab.classList.toggle("text-muted", !active);
  tab.classList.toggle("hover:bg-white/10", !active);
  tab.classList.toggle("hover:text-accent", !active);
}

function syncWarnings() {
  state.warnings = [
    ...(state.analysis.warnings || []),
    ...(state.conversion.warnings || []),
    ...(state.validation.warnings || []),
    ...((state.validation.errors || []).map((item) => ({ ...item, severity: "error" })))
  ];
}

function renderSummary() {
  const outputCounts = state.conversion.summary?.outputCounts;
  const rows = [
    ["Text blocks", outputCounts ? outputCounts.textBlocks : state.analysis.textBlocks?.length || 0],
    ["Image blocks", outputCounts ? outputCounts.imageBlocks : state.analysis.imageBlocks?.length || 0],
    ["Button blocks", outputCounts ? outputCounts.buttonBlocks : state.analysis.buttonBlocks?.length || 0]
  ];

  const converted = statusPill("Converted", conversionStatus());
  const valid = statusPill("Valid", validationStatus());

  const countRows = rows.map(([label, value]) => `
    <div class="flex items-center justify-between border-b border-line py-2.5 last:border-b-0">
      <dt class="text-sm font-semibold text-muted">${escapeHtml(label)}</dt>
      <dd class="text-sm font-extrabold text-ink">${escapeHtml(value)}</dd>
    </div>
  `).join("");

  els.summaryRows.innerHTML = `
    ${countRows}
    <div class="mt-4 grid grid-cols-2 gap-3">
      ${converted}
      ${valid}
    </div>
  `;
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function conversionStatus() {
  const converted = state.conversion.summary?.converted;
  if (converted === true) {
    return { tone: "success", icon: "check-circle-2", value: "Converted" };
  }
  if (converted === false) {
    return { tone: "error", icon: "x-circle", value: "Failed" };
  }
  return { tone: "neutral", icon: "circle-dashed", value: "Not run" };
}

function validationStatus() {
  const isValid = state.validation.isValid;
  if (isValid === true) {
    return { tone: "success", icon: "check-circle-2", value: "Valid" };
  }
  if (isValid === false) {
    return { tone: "error", icon: "x-circle", value: "Invalid" };
  }
  if ((state.validation.warnings || []).length > 0) {
    return { tone: "warning", icon: "triangle-alert", value: "Review" };
  }
  return { tone: "neutral", icon: "circle-dashed", value: "Not run" };
}

function statusPill(label, status) {
  const tones = {
    success: "border-emerald-300/35 bg-emerald-400/10 text-emerald-200",
    error: "border-red-300/35 bg-red-400/10 text-red-200",
    warning: "border-orange-300/35 bg-orange-400/10 text-orange-200",
    neutral: "border-white/15 bg-white/5 text-muted"
  };
  return `
    <div class="flex h-11 items-center justify-center rounded-lg border px-4 shadow-sm ${tones[status.tone]}">
      <div class="flex items-center justify-center gap-2">
        <i data-lucide="${status.icon}" class="h-4 w-4 shrink-0"></i>
        <span class="text-xs font-extrabold uppercase tracking-wide">${escapeHtml(label)}</span>
      </div>
    </div>
  `;
}

function renderWarnings() {
  els.warningCount.textContent = String(state.warnings.length);
  els.malformedBadge.classList.toggle("hidden", !state.warnings.some((item) => item.type === "malformed-html"));
  if (!state.warnings.length) {
    els.warningsPanel.innerHTML = '<p class="px-1 py-2 text-sm font-medium text-muted">No warnings or errors yet.</p>';
    return;
  }
  els.warningsPanel.innerHTML = `<ul class="space-y-2">${state.warnings.map((item, index) => `
    <li class="rounded-lg border border-line bg-white/5 px-3 py-2 shadow-sm" data-index="${index}">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-extrabold uppercase tracking-wide text-accent">${escapeHtml(item.severity || "warning")}</span>
        <span class="text-xs font-semibold text-muted">${escapeHtml(item.type || "pipeline")}</span>
      </div>
      <p class="mt-1 text-sm font-medium leading-5 text-ink">${escapeHtml(item.message || "Review this item.")}</p>
      ${item.path ? `<p class="mt-1 break-all text-xs text-muted">${escapeHtml(item.path)}</p>` : ""}
    </li>
  `).join("")}</ul>`;
}

function refreshPreviews() {
  const original = els.originalHtml.value;
  const converted = els.convertedHtml.value;
  els.originalPreview.srcdoc = original || emptyPreview("Paste or load original HTML to preview it.");
  els.convertedPreview.srcdoc = converted || emptyPreview("Run Convert to preview converted HTML.");
}

function emptyPreview(message) {
  return `<!doctype html><html><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:14px Arial;color:#657084;text-align:center;padding:24px;">${escapeHtml(message)}</body></html>`;
}

async function copyConvertedHtml() {
  if (!els.convertedHtml.value.trim()) {
    setCopyButtonLabel("Nothing to copy");
    window.setTimeout(() => setCopyButtonLabel("Copy"), 1400);
    return;
  }
  await navigator.clipboard.writeText(els.convertedHtml.value);
  setCopyButtonLabel("Copied");
  window.setTimeout(() => setCopyButtonLabel("Copy"), 1400);
}

function setCopyButtonLabel(text) {
  els.copyButton.querySelector("span").textContent = text;
}

function setStatus(text) {
  els.statusText.textContent = text;
  els.statusText.classList.toggle("hidden", !text);
}

function showError(message) {
  els.errorBox.textContent = message;
  els.errorBox.classList.remove("hidden");
}

function clearError() {
  els.errorBox.textContent = "";
  els.errorBox.classList.add("hidden");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

// ── Public API ─────────────────────────────────────────────────
window.Pattens = window.Pattens || {};
window.Pattens.converter = {
  runPipeline,
  copyConvertedHtml,
  refreshPreviews,
  resetPipelineState,
  // Exposed for testing
  _analyseEmailHtml: analyseEmailHtml,
  _convertEmailHtml: convertEmailHtml,
  _validateConvertedHtml: validateConvertedHtml,
  _parseHtml: parseHtml,
  _escapeHtml: escapeHtml,
  _dedupeWarnings: dedupeWarnings,
  _conversionMarkerSummary: conversionMarkerSummary,
  _issue: issue,
};

// ── Init ───────────────────────────────────────────────────────
try {
  init();
} catch (e) {
  console.error("Converter init error:", e);
}

})();
