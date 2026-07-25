(function () {
  "use strict";

  const STORAGE_KEY = "pattens.generate.items.v1";
  const MAX_SAVED_ITEMS = 100;

  const options = {
    surveyLanguages: [
      { value: "en-us", label: "English" },
      { value: "de", label: "German" },
      { value: "zh-cn", label: "Chinese" }
    ],
    years: [
      { value: "26", label: "2026" },
      { value: "25", label: "2025" }
    ],
    regions: [
      { value: "", label: "None" },
      { value: "WW", label: "World Wide" },
      { value: "EU", label: "Europe" },
      { value: "ROW", label: "Rest of World" },
      { value: "NAM", label: "North America" },
      { value: "ISEA", label: "India & South East Asia" }
    ],
    languages: [
      { value: "", label: "None" },
      { value: "EN", label: "English" },
      { value: "DE", label: "German" },
      { value: "ZH", label: "Chinese" }
    ]
  };

  const state = { items: [], activeType: "Link", linkTrackingType: "MTM" };
  const els = {
    typeTabs: document.querySelectorAll(".generator-type-tab"),
    surveyForm: document.getElementById("surveyGeneratorForm"),
    surveyBaseUrl: document.getElementById("surveyBaseUrl"),
    surveyLanguage: document.getElementById("surveyLanguage"),
    surveyLob: document.getElementById("surveyLob"),
    surveyJourney: document.getElementById("surveyJourney"),
    surveyCampaign: document.getElementById("surveyCampaign"),
    surveyContent: document.getElementById("surveyContent"),
    surveyMedium: document.getElementById("surveyMedium"),
    surveyPreview: document.getElementById("surveyPreview"),
    surveyError: document.getElementById("surveyFormError"),
    linkForm: document.getElementById("linkGeneratorForm"),
    linkBaseUrl: document.getElementById("linkBaseUrl"),
    linkHighlightText: document.getElementById("linkHighlightText"),
    linkTrackingButtons: document.querySelectorAll(".link-tracking-type-toggle"),
    linkSource: document.getElementById("linkSource"),
    linkMedium: document.getElementById("linkMedium"),
    linkCampaign: document.getElementById("linkCampaign"),
    linkContent: document.getElementById("linkContent"),
    linkTerm: document.getElementById("linkTerm"),
    linkCrmCampaign: document.getElementById("linkCrmCampaign"),
    linkPreview: document.getElementById("linkPreview"),
    linkError: document.getElementById("linkFormError"),
    campaignForm: document.getElementById("campaignGeneratorForm"),
    business: document.getElementById("campaignBusiness"),
    year: document.getElementById("campaignYear"),
    region: document.getElementById("campaignRegion"),
    language: document.getElementById("campaignLanguage"),
    descriptor: document.getElementById("campaignDescriptor"),
    salesplay: document.getElementById("campaignSalesplay"),
    campaignPreview: document.getElementById("campaignPreview"),
    campaignError: document.getElementById("campaignFormError"),
    list: document.getElementById("generatedItemsList"),
    count: document.getElementById("generatedItemCount"),
    actions: document.getElementById("generatorActions"),
    generate: document.getElementById("generateItemButton"),
    validatePreview: document.getElementById("validateGeneratorPreviewButton"),
    copyPreview: document.getElementById("copyGeneratorPreviewButton"),
    clear: document.getElementById("clearGeneratedItemsButton"),
    readyCard: document.getElementById("generatorReadyCard"),
    readyTitle: document.getElementById("generatorReadyTitle"),
    readyDescription: document.getElementById("generatorReadyDescription"),
    status: document.getElementById("generatorStatusText"),
    formatTitle: document.getElementById("generatorFormatTitle"),
    formatDescription: document.getElementById("generatorFormatDescription")
  };

  function normalizeSegment(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function buildCampaignCode(values) {
    return [
      values.business,
      values.year,
      values.region,
      values.descriptor,
      values.salesplay,
      values.language
    ].map(normalizeSegment).filter(Boolean).join("-");
  }

  function uppercaseTrackingValue(value) {
    return String(value || "").trim().toUpperCase();
  }

  function currentLinkTrackingType() {
    return state.linkTrackingType === "UTM" ? "UTM" : "MTM";
  }

  function setLinkTrackingType(type) {
    if (!["MTM", "UTM"].includes(type)) return;
    state.linkTrackingType = type;
    els.linkTrackingButtons.forEach(button => {
      const active = button.dataset.linkTrackingType === type;
      button.classList.toggle("bg-accentSoft", active);
      button.classList.toggle("text-accent", active);
      button.classList.toggle("ring-1", active);
      button.classList.toggle("ring-accent/70", active);
      button.classList.toggle("text-muted", !active);
      button.classList.toggle("hover:bg-white/10", !active);
      button.classList.toggle("hover:text-white", !active);
      button.setAttribute("aria-pressed", String(active));
    });
    updateLinkPreview();
  }

  function buildLinkUrl(values) {
    let url;
    try {
      url = new URL(String(values.baseUrl || "").trim());
    } catch (error) {
      return "";
    }

    const basePath = url.pathname.replace(/\/+$/g, "");
    url.pathname = `${basePath}/`.replace(/\/{2,}/g, "/");
    url.search = "";
    url.hash = "";

    const trackingPrefix = values.trackingType === "UTM" ? "utm" : "mtm";
    const tracking = [
      [`${trackingPrefix}_source`, values.source],
      [`${trackingPrefix}_medium`, values.medium],
      [`${trackingPrefix}_campaign`, values.campaign],
      [`${trackingPrefix}_content`, values.content],
      [`${trackingPrefix}_term`, values.term],
      ["crm_campaign", values.crmCampaign]
    ];
    tracking.forEach(([key, value]) => {
      const normalized = uppercaseTrackingValue(value);
      if (normalized) url.searchParams.set(key, normalized);
    });
    return url.toString();
  }

  function normalizeHighlightText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function buildHighlightUrl(baseGeneratedUrl, highlightText) {
    const normalizedHighlight = normalizeHighlightText(highlightText);
    if (!normalizedHighlight) return "";

    let url;
    try {
      url = new URL(String(baseGeneratedUrl || "").trim());
    } catch (error) {
      return "";
    }

    url.hash = "";
    return `${url.toString()}#:~:text=${encodeURIComponent(normalizedHighlight)}`;
  }

  function buildSurveyUrl(values) {
    const baseUrl = String(values.baseUrl || "").trim().replace(/[?&]+$/g, "");
    if (!baseUrl) return "";
    try {
      new URL(baseUrl);
    } catch (error) {
      return "";
    }

    const context = {
      journey: String(values.journey || "").trim().toLowerCase(),
      lob: String(values.lob || "").trim(),
      source: "CRM",
      campaign: String(values.campaign || "").trim().toLowerCase(),
      medium: String(values.medium || "").trim(),
      content: String(values.content || "").trim().toLowerCase()
    };
    const language = String(values.lang || "").trim().toLowerCase();
    return `${baseUrl}&lang=${encodeURIComponent(language)}&ctx=${encodeURIComponent(JSON.stringify(context))}`;
  }

  function renderPreview(element, value, fallback) {
    if (!element) return;
    const text = value || fallback;
    element.innerHTML = colorizePreview(text);
  }

  function colorizePreview(value) {
    const raw = String(value || "");
    const fragmentMarker = "#:~:text=";
    const fragmentIndex = raw.indexOf(fragmentMarker);
    const base = fragmentIndex >= 0 ? raw.slice(0, fragmentIndex) : raw;
    const fragment = fragmentIndex >= 0 ? raw.slice(fragmentIndex + fragmentMarker.length) : "";
    const markerIndex = base.search(/[?#&]/);
    const highlightedBase = markerIndex < 0
      ? escapeHtml(base)
      : escapeHtml(base.slice(0, markerIndex)) + base.slice(markerIndex).replace(/([?&])([^=&#]+)=([^&#]+)/g, (match, separator, key, val) => {
      return `${escapeHtml(separator)}<span class="text-sky-300">${escapeHtml(key)}</span>=<span class="${previewValueColor(key)}">${escapeHtml(val)}</span>`;
    });
    if (fragmentIndex < 0) return highlightedBase;
    return `${highlightedBase}<span class="text-fuchsia-300">${escapeHtml(fragmentMarker)}</span><span class="text-pink-300">${escapeHtml(fragment)}</span>`;
  }

  function previewValueColor(key) {
    if (/campaign/i.test(key)) return "text-amber-300";
    if (/medium/i.test(key)) return "text-orange-300";
    if (/content|source/i.test(key)) return "text-emerald-300";
    if (/term/i.test(key)) return "text-rose-300";
    if (/ctx|lang/i.test(key)) return "text-purple-300";
    return "text-accent";
  }

  function currentCampaignValues() {
    return {
      business: els.business?.value || "",
      year: els.year?.value || "",
      region: els.region?.value || "",
      descriptor: els.descriptor?.value || "",
      salesplay: els.salesplay?.value || "",
      language: els.language?.value || ""
    };
  }

  function currentLinkValues() {
    return {
      baseUrl: els.linkBaseUrl?.value || "",
      highlightText: els.linkHighlightText?.value || "",
      trackingType: currentLinkTrackingType(),
      source: els.linkSource?.value || "",
      medium: els.linkMedium?.value || "",
      campaign: els.linkCampaign?.value || "",
      content: els.linkContent?.value || "",
      term: els.linkTerm?.value || "",
      crmCampaign: els.linkCrmCampaign?.value || ""
    };
  }

  function currentSurveyValues() {
    return {
      baseUrl: els.surveyBaseUrl?.value || "",
      lang: els.surveyLanguage?.value || "",
      journey: els.surveyJourney?.value || "",
      lob: els.surveyLob?.value || "",
      campaign: els.surveyCampaign?.value || "",
      content: els.surveyContent?.value || "",
      medium: els.surveyMedium?.value || ""
    };
  }

  function fillSelect(select, values) {
    if (!select) return;
    select.innerHTML = "";
    values.forEach(item => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    });
  }

  function loadItems() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      state.items = Array.isArray(stored)
        ? stored.filter(item => item && ["Campaign", "Link", "Survey"].includes(item.type) && typeof item.value === "string").slice(0, MAX_SAVED_ITEMS)
        : [];
    } catch (error) {
      state.items = [];
      setStatus("Saved items could not be loaded.");
    }
    renderItems();
  }

  function saveItems() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
      return true;
    } catch (error) {
      showError("This browser could not save the generated item.");
      return false;
    }
  }

  function updateCampaignPreview() {
    if (!els.campaignPreview) return "";
    const value = buildCampaignCode(currentCampaignValues());
    renderPreview(els.campaignPreview, value, "Campaign preview");
    clearError("Campaign");
    updateActionButtonStates();
    return value;
  }

  function isLinkComplete(values = currentLinkValues()) {
    return [
      values.baseUrl,
      values.trackingType,
      values.source,
      values.medium,
      values.campaign,
      values.crmCampaign
    ].every(value => String(value).trim()) && Boolean(buildLinkUrl(values));
  }

  function isCampaignComplete(values = currentCampaignValues()) {
    return [values.business, values.year, values.descriptor, values.salesplay]
      .every(value => String(value).trim());
  }

  function isSurveyComplete(values = currentSurveyValues()) {
    return Object.values(values).every(value => String(value).trim()) && Boolean(buildSurveyUrl(values));
  }

  function isActiveFormComplete() {
    if (state.activeType === "Link") return isLinkComplete();
    if (state.activeType === "Survey") return isSurveyComplete();
    return isCampaignComplete();
  }

  function updateActionButtonStates() {
    const disabled = !isActiveFormComplete();
    if (els.generate) els.generate.disabled = disabled;
    if (els.validatePreview) els.validatePreview.disabled = disabled || state.activeType === "Campaign";
    if (els.copyPreview) els.copyPreview.disabled = disabled;
  }

  function currentLinkPreviewUrl(values = currentLinkValues()) {
    const trackingUrl = buildLinkUrl(values);
    if (!trackingUrl) return "";
    return buildHighlightUrl(trackingUrl, values.highlightText) || trackingUrl;
  }

  function updateLinkPreview() {
    if (!els.linkPreview) return "";
    const values = currentLinkValues();
    const value = currentLinkPreviewUrl(values);
    renderPreview(els.linkPreview, value, "Link preview");
    clearError("Link");
    updateLinkFormatDescription();
    updateActionButtonStates();
    return value;
  }

  function updateSurveyPreview() {
    if (!els.surveyPreview) return "";
    const value = buildSurveyUrl(currentSurveyValues());
    renderPreview(els.surveyPreview, value, "Survey preview");
    clearError("Survey");
    updateActionButtonStates();
    return value;
  }

  function updateActivePreview() {
    if (state.activeType === "Link") return updateLinkPreview();
    if (state.activeType === "Survey") return updateSurveyPreview();
    return updateCampaignPreview();
  }

  function showReadyCard(action) {
    if (!els.readyCard) return;
    const noun = state.activeType.toLowerCase();
    if (els.readyTitle) els.readyTitle.textContent = `Your ${noun} is ready to use`;
    if (els.readyDescription) {
      els.readyDescription.textContent = action === "copy"
        ? `Copied ${noun} to the clipboard.`
        : `Copy the ${noun} or use it in your campaigns.`;
    }
    els.readyCard.classList.remove("hidden");
    els.readyCard.classList.add("flex");
  }

  function hideReadyCard() {
    if (!els.readyCard) return;
    els.readyCard.classList.add("hidden");
    els.readyCard.classList.remove("flex");
  }

  function addItem(type, value, fields) {
    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      value,
      fields,
      createdAt: new Date().toISOString()
    };
    state.items.unshift(item);
    state.items = state.items.slice(0, MAX_SAVED_ITEMS);
    if (!saveItems()) {
      state.items.shift();
      return null;
    }
    renderItems();
    return item;
  }

  function generateCampaign(event) {
    event?.preventDefault();
    const values = currentCampaignValues();
    if (!isCampaignComplete(values)) return null;
    const item = addItem("Campaign", buildCampaignCode(values), values);
    if (item) showReadyCard("generate");
    return item;
  }

  function generateLink(event) {
    event?.preventDefault();
    const values = currentLinkValues();
    if (!isLinkComplete(values)) return null;
    const trackingUrl = buildLinkUrl(values);
    const normalizedHighlight = normalizeHighlightText(values.highlightText);
    const previewUrl = currentLinkPreviewUrl(values);
    const fields = {
      ...values,
      highlightText: normalizedHighlight,
      trackingUrl,
      usedHighlightLink: Boolean(normalizedHighlight)
    };
    const item = addItem("Link", previewUrl, fields);
    if (item) showReadyCard("generate");
    return item;
  }

  function generateSurvey(event) {
    event?.preventDefault();
    const values = currentSurveyValues();
    const value = buildSurveyUrl(values);
    if (!isSurveyComplete(values) || !value) return null;
    const item = addItem("Survey", value, values);
    if (item) showReadyCard("generate");
    return item;
  }

  function generateActiveItem() {
    if (state.activeType === "Link") return generateLink();
    if (state.activeType === "Survey") return generateSurvey();
    return generateCampaign();
  }

  function setActiveType(type) {
    if (!["Link", "Campaign", "Survey"].includes(type)) return;
    state.activeType = type;
    const isLink = type === "Link";
    const isSurvey = type === "Survey";
    const isCampaign = type === "Campaign";
    els.surveyForm?.classList.toggle("hidden", !isSurvey);
    els.linkForm?.classList.toggle("hidden", !isLink);
    els.campaignForm?.classList.toggle("hidden", !isCampaign);
    els.surveyPreview?.classList.toggle("hidden", !isSurvey);
    els.linkPreview?.classList.toggle("hidden", !isLink);
    els.campaignPreview?.classList.toggle("hidden", !isCampaign);
    els.validatePreview?.classList.toggle("hidden", isCampaign);
    els.clear?.classList.toggle("col-span-2", isCampaign);
    els.typeTabs.forEach(tab => {
      const active = tab.dataset.generatorType === type;
      tab.classList.toggle("text-accent", active);
      tab.classList.toggle("text-muted", !active);
      tab.classList.toggle("hover:text-white", !active);
      tab.classList.toggle("relative", active);
      tab.classList.toggle("after:absolute", active);
      tab.classList.toggle("after:inset-x-0", active);
      tab.classList.toggle("after:bottom-0", active);
      tab.classList.toggle("after:h-0.5", active);
      tab.classList.toggle("after:bg-accent", active);
      tab.classList.toggle("after:content-['']", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    if (els.generate) {
      const label = els.generate.querySelector("span");
      if (label) label.textContent = `Generate ${type}`;
    }
    if (els.formatTitle) {
      els.formatTitle.textContent = isSurvey ? "Survey format" : isLink ? "Link format" : "Campaign format";
    }
    if (els.formatDescription) {
      els.formatDescription.textContent = isSurvey
        ? "Editable survey URL followed by language and an encoded CRM context object."
          : isLink
            ? ""
            : "Campaign name, year, optional region, descriptor, sales play, and optional language joined with hyphens.";
      updateLinkFormatDescription();
    }
    clearError();
    hideReadyCard();
    updateActivePreview();
    updateActionButtonStates();
  }

  function validateActiveUrl() {
    if (state.activeType === "Campaign" || !isActiveFormComplete()) return;
    const url = updateActivePreview();
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyText(value, message) {
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      setStatus(message);
      return true;
    } catch (error) {
      showError("Clipboard access is unavailable in this browser.");
      return false;
    }
  }

  async function copyActivePreview() {
    const value = updateActivePreview();
    if (!value) return;
    if (await copyText(value, `${state.activeType} preview copied.`)) {
      showReadyCard("copy");
    }
  }

  function deleteItem(id) {
    state.items = state.items.filter(item => item.id !== id);
    saveItems();
    renderItems();
    setStatus("Saved item deleted.");
  }

  function clearItems() {
    if (!state.items.length) return;
    state.items = [];
    saveItems();
    renderItems();
    setStatus("Saved items cleared.");
  }

  function renderItems() {
    if (!els.list || !els.count) return;
    els.count.textContent = `${state.items.length} ${state.items.length === 1 ? "item" : "items"}`;
    if (els.clear) els.clear.disabled = state.items.length === 0;
    if (!state.items.length) {
      els.list.innerHTML = '<p class="px-1 py-2 text-sm font-medium text-muted">Generated items will appear here.</p>';
      return;
    }

    els.list.innerHTML = `<div class="relative min-w-0 max-w-full pl-5">
      <div class="absolute bottom-8 left-2 top-2 w-px bg-white/10"></div>
      <div class="grid min-w-0 max-w-full">${state.items.map(item => `
        <article data-saved-type="${escapeHtml(item.type)}" class="relative min-w-0 max-w-full border-b border-white/10 py-4 last:border-b-0">
          <span class="absolute -left-[18px] top-7 grid h-4 w-4 place-items-center rounded-full ${savedDotClass(item.type)}"><span class="h-1.5 w-1.5 rounded-full bg-[#061014]"></span></span>
          <div class="flex min-w-0 max-w-full items-start justify-between gap-3">
            <div class="min-w-0 flex-1 overflow-hidden">
              <div class="flex flex-wrap items-center gap-2">
                <p data-saved-title class="rounded-md px-2.5 py-1 text-xs font-extrabold uppercase ${savedBadgeClass(item.type)}">${escapeHtml(item.type)}</p>
                ${itemHasHighlight(item) ? '<span class="rounded-md border border-accent/30 bg-accentSoft px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-accent">HIGHLIGHT</span>' : ''}
              </div>
              <p data-saved-result class="mt-2 truncate font-sans text-base font-extrabold leading-6 text-white" title="${escapeHtml(item.value)}">${escapeHtml(savedDisplayValue(item))}</p>
              <p class="mt-1 truncate text-xs font-bold text-muted">${escapeHtml(savedMeta(item))}</p>
              ${savedHighlightPreview(item)}
              <time class="mt-1 block text-xs font-semibold text-muted" datetime="${escapeHtml(item.createdAt)}">${escapeHtml(formatDate(item.createdAt))}</time>
            </div>
            <div class="flex shrink-0 items-center gap-1 pt-5">
              <button type="button" data-generator-action="copy" data-item-id="${escapeHtml(item.id)}" class="rounded-md p-2 text-muted transition hover:bg-white/10 hover:text-accent" aria-label="Copy ${escapeHtml(item.value)}" title="Copy">
                <i data-lucide="copy" class="h-4 w-4"></i>
              </button>
              <button type="button" data-generator-action="delete" data-item-id="${escapeHtml(item.id)}" class="rounded-md p-2 text-muted transition hover:bg-red-400/10 hover:text-red-200" aria-label="Delete ${escapeHtml(item.value)}" title="Delete">
                <i data-lucide="trash-2" class="h-4 w-4"></i>
              </button>
            </div>
          </div>
        </article>
      `).join("")}</div>
      <button type="button" class="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/10 text-sm font-extrabold text-accent transition hover:border-accent/50 hover:bg-accentSoft">
        <span>Load more</span><i data-lucide="chevron-down" class="h-4 w-4"></i>
      </button>
    </div>`;
    window.lucide?.createIcons();
  }

  function savedBadgeClass(type) {
    if (type === "Link") return "bg-sky-400/15 text-sky-300";
    if (type === "Campaign") return "bg-emerald-400/15 text-emerald-300";
    if (type === "Survey") return "bg-purple-400/15 text-purple-300";
    return "bg-accentSoft text-accent";
  }

  function savedDotClass(type) {
    if (type === "Link") return "bg-sky-400";
    if (type === "Campaign") return "bg-emerald-400";
    if (type === "Survey") return "bg-purple-400";
    return "bg-accent";
  }

  function savedDisplayValue(item) {
    if (item.type === "Campaign") return item.value;
    try {
      const url = new URL(item.fields?.trackingUrl || item.value);
      return `${url.hostname}${url.pathname}`.replace(/\/$/g, "") || item.value;
    } catch (error) {
      return item.value;
    }
  }

  function savedMeta(item) {
    if (item.type === "Link") return `${item.fields?.source || "CRM"} • ${item.fields?.medium || "Email"} • ${item.fields?.trackingType || "MTM"}`;
    if (item.type === "Campaign") return [item.fields?.business, item.fields?.year, item.fields?.region, item.fields?.language].filter(Boolean).join(" • ") || "Campaign";
    if (item.type === "Survey") return `${item.fields?.lob || "Survey"} • ${item.fields?.lang || "en-us"}`;
    return item.type;
  }

  function itemHasHighlight(item) {
    return Boolean(item?.fields?.usedHighlightLink);
  }

  function savedHighlightPreview(item) {
    const highlightText = item?.fields?.highlightText;
    if (!highlightText) return "";
    return `<p data-saved-highlight class="mt-1 truncate text-xs font-semibold text-muted" title="${escapeHtml(highlightText)}">${escapeHtml(highlightText)}</p>`;
  }

  function handleListAction(event) {
    const button = event.target.closest("[data-generator-action]");
    if (!button) return;
    const item = state.items.find(candidate => candidate.id === button.dataset.itemId);
    if (!item) return;
    if (button.dataset.generatorAction === "copy") copyText(item.value, "Saved item copied.");
    if (button.dataset.generatorAction === "delete") deleteItem(item.id);
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Saved" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  function showError(message, type = state.activeType) {
    const errorElement = type === "Survey" ? els.surveyError : type === "Link" ? els.linkError : els.campaignError;
    if (!errorElement) return;
    errorElement.textContent = message;
    errorElement.classList.remove("hidden");
  }

  function clearError(type) {
    const errorElements = type
      ? [type === "Survey" ? els.surveyError : type === "Link" ? els.linkError : els.campaignError]
      : [els.surveyError, els.linkError, els.campaignError];
    errorElements.filter(Boolean).forEach(errorElement => {
      errorElement.textContent = "";
      errorElement.classList.add("hidden");
    });
  }

  function setStatus(message) {
    if (!els.status) return;
    els.status.textContent = message;
    els.status.classList.toggle("hidden", !message);
  }

  function updateLinkFormatDescription() {
    if (!els.formatDescription || state.activeType !== "Link") return;
    els.formatDescription.textContent = currentLinkTrackingType() === "UTM"
      ? "Base URL and path followed by uppercase UTM and CRM campaign tracking parameters."
      : "Base URL and path followed by uppercase MTM and CRM campaign tracking parameters.";
  }

  function init() {
    if (!els.campaignForm || !els.linkForm || !els.surveyForm) return;
    fillSelect(els.surveyLanguage, options.surveyLanguages);
    fillSelect(els.year, options.years);
    fillSelect(els.region, options.regions);
    fillSelect(els.language, options.languages);
    els.typeTabs.forEach(tab => tab.addEventListener("click", () => setActiveType(tab.dataset.generatorType)));
    els.surveyForm.addEventListener("submit", generateSurvey);
    els.surveyForm.addEventListener("input", updateSurveyPreview);
    els.surveyForm.addEventListener("change", updateSurveyPreview);
    els.linkForm.addEventListener("submit", generateLink);
    els.linkForm.addEventListener("input", updateLinkPreview);
    els.linkForm.addEventListener("change", updateLinkPreview);
    els.linkTrackingButtons.forEach(button => button.addEventListener("click", () => setLinkTrackingType(button.dataset.linkTrackingType)));
    els.campaignForm.addEventListener("submit", generateCampaign);
    els.campaignForm.addEventListener("input", updateCampaignPreview);
    els.campaignForm.addEventListener("change", updateCampaignPreview);
    els.generate?.addEventListener("click", generateActiveItem);
    els.validatePreview?.addEventListener("click", validateActiveUrl);
    els.copyPreview?.addEventListener("click", copyActivePreview);
    els.clear?.addEventListener("click", clearItems);
    els.list?.addEventListener("click", handleListAction);
    updateSurveyPreview();
    updateLinkPreview();
    updateCampaignPreview();
    setActiveType("Link");
    loadItems();
  }

  window.Pattens = window.Pattens || {};
  window.Pattens.generator = {
    buildCampaignCode,
    buildLinkUrl,
    buildHighlightUrl,
    buildSurveyUrl,
    generateCampaign,
    generateLink,
    generateSurvey,
    validateActiveUrl,
    setActiveType,
    setLinkTrackingType,
    loadItems,
    deleteItem,
    clearItems,
    state,
    options,
    storageKey: STORAGE_KEY
  };

  init();
})();
