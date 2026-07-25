(function () {
  'use strict';

  var MASTER_LIST_URL = './assets/countries.csv';
  var state = { countries: [], items: [], xml: '', loaded: false };
  var els = {
    input: document.getElementById('logicCountryInput'),
    validate: document.getElementById('logicValidateButton'),
    generate: document.getElementById('logicGenerateButton'),
    copy: document.getElementById('logicCopyButton'),
    clear: document.getElementById('logicClearButton'),
    summary: document.getElementById('logicSummaryRows'),
    error: document.getElementById('logicErrorBox'),
    output: document.getElementById('logicXmlOutput'),
    summaryTab: document.getElementById('logicSummaryTab'),
    warningsTab: document.getElementById('logicWarningsTab'),
    summaryPanel: document.getElementById('logicSummaryPanel'),
    warningsPanel: document.getElementById('logicWarningsPanel'),
    warningCount: document.getElementById('logicWarningCount'),
    warningsEmpty: document.getElementById('logicWarningsEmpty'),
    invalidList: document.getElementById('logicInvalidCountryList')
  };

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  }

  function escapeXml(value) {
    return String(value || '').replace(/[<>&"']/g, function (character) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character];
    });
  }

  /**
   * Parses the bundled country master CSV into GUID and canonical-name records.
   * @param {string} text Country CSV content.
   * @returns {Array<{id: string, name: string}>} Parsed country records.
   */
  function parseCsv(text) {
    return String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).slice(1).map(function (line) {
      var match = line.match(/^([^,]+),(?:"([^"]+)"|(.+))$/);
      return match ? { id: match[1].trim(), name: (match[2] || match[3]).trim() } : null;
    }).filter(Boolean);
  }

  /**
   * Confirms that the country master CSV uses the expected source columns.
   * @param {string} text Country CSV content.
   * @returns {boolean} Whether the header row is exactly nor_countryid,nor_name.
   */
  function hasExpectedHeaders(text) {
    var header = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].trim();
    return header === 'nor_countryid,nor_name';
  }

  /**
   * Confirms that a country master list has unique normalized names and valid GUIDs.
   * @param {Array<{id: string, name: string}>} countries Country master records.
   * @returns {boolean} Whether the master list is safe to use for generation.
   */
  function isValidMasterList(countries) {
    var guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    var names = new Set();
    return countries.length > 0 && countries.every(function (country) {
      var key = normalize(country.name);
      if (!key || !guidPattern.test(country.id) || names.has(key)) return false;
      names.add(key);
      return true;
    });
  }

  /**
   * Validates country names against a supplied master list.
   * @param {string} input Newline-separated country names.
   * @param {Array<{id: string, name: string}>} countries Country master records.
   * @returns {Array<object>} Validated country entries.
   */
  function validateCountries(input, countries) {
    var master = new Map(countries.map(function (country) { return [normalize(country.name), country]; }));
    var seen = new Set();
    return String(input || '').split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean).map(function (name) {
      var key = normalize(name);
      if (seen.has(key)) return { input: name, status: 'duplicate' };
      seen.add(key);
      return master.has(key) ? { input: name, status: 'valid', country: master.get(key) } : { input: name, status: 'invalid' };
    });
  }

  /**
   * Builds the FetchXML query for validated country entries.
   * @param {Array<object>} items Validated country entries.
   * @returns {string} Completed FetchXML.
   */
  function buildFetchXml(items) {
    var values = items.filter(function (item) { return item.status === 'valid'; }).map(function (item) {
      return '        <value uiname="' + escapeXml(item.country.name) + '" uitype="nor_country">{' + escapeXml(item.country.id) + '}</value>';
    });
    return ['<fetch version="1.0" mapping="logical" distinct="true">', '  <entity name="lead">', '    <filter type="and">', '      <condition attribute="nor_country" operator="in">'].concat(values, ['      </condition>', '    </filter>', '  </entity>', '</fetch>']).join('\n');
  }

  function renderSummary() {
    if (!els.summary) return;
    var groups = [['Valid', 'valid'], ['Invalid', 'invalid'], ['Duplicate', 'duplicate']];
    els.summary.replaceChildren();
    groups.forEach(function (group) {
      var values = state.items.filter(function (item) { return item.status === group[1]; });
      var card = document.createElement('div');
      card.className = 'flex items-center justify-between border-b border-line py-2.5 last:border-b-0';
      var title = document.createElement('dt');
      title.className = 'text-sm font-semibold text-muted';
      title.textContent = group[0];
      var detail = document.createElement('dd');
      detail.className = 'text-sm font-extrabold text-ink';
      detail.textContent = String(values.length);
      card.append(title, detail);
      els.summary.appendChild(card);
    });
    var hasValidationFailure = state.items.some(function (item) { return item.status !== 'valid'; });
    var isReady = state.items.length && !hasValidationFailure;
    var statusRow = document.createElement('div');
    statusRow.className = 'mt-4';
    statusRow.append(createStatusPill(hasValidationFailure ? 'Error' : 'Ready', isReady ? 'success' : hasValidationFailure ? 'error' : 'neutral'));
    els.summary.appendChild(statusRow);
    renderWarnings();
  }

  function createStatusPill(label, tone) {
    var tones = { success: 'border-emerald-300/40 bg-emerald-400/10 text-emerald-200', error: 'border-red-300/40 bg-red-400/10 text-red-200', neutral: 'border-white/15 bg-white/5 text-muted' };
    var pill = document.createElement('div');
    pill.className = 'flex h-11 items-center justify-center rounded-lg border px-4 shadow-sm ' + tones[tone];
    var icon = document.createElement('i');
    icon.setAttribute('data-lucide', tone === 'success' ? 'check-circle-2' : tone === 'error' ? 'x-circle' : 'circle-dashed');
    icon.className = 'h-4 w-4 shrink-0';
    var text = document.createElement('span');
    text.className = 'ml-2 text-xs font-extrabold uppercase tracking-wide';
    text.textContent = label;
    pill.append(icon, text);
    return pill;
  }

  function renderWarnings() {
    if (!els.invalidList || !els.warningCount) return;
    var invalid = state.items.filter(function (item) { return item.status === 'invalid'; });
    var duplicates = state.items.filter(function (item) { return item.status === 'duplicate'; });
    els.warningCount.textContent = String(invalid.length + duplicates.length);
    els.invalidList.replaceChildren();
    invalid.forEach(function (item) {
      var row = document.createElement('li');
      row.className = 'rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-medium text-ink';
      row.textContent = item.input;
      els.invalidList.appendChild(row);
    });
    els.invalidList.classList.toggle('hidden', invalid.length === 0);
    els.warningsEmpty.classList.toggle('hidden', invalid.length > 0);
    if (window.lucide) window.lucide.createIcons();
  }

  function setActiveDetails(tabName) {
    var isSummary = tabName === 'summary';
    els.summaryPanel.classList.toggle('hidden', !isSummary);
    els.warningsPanel.classList.toggle('hidden', isSummary);
    [els.summaryTab, els.warningsTab].forEach(function (tab) {
      var active = tab === (isSummary ? els.summaryTab : els.warningsTab);
      tab.classList.toggle('bg-white/10', active);
      tab.classList.toggle('text-white', active);
      tab.classList.toggle('shadow-sm', active);
      tab.classList.toggle('ring-1', active);
      tab.classList.toggle('ring-white/15', active);
      tab.classList.toggle('text-muted', !active);
      tab.classList.toggle('hover:bg-white/10', !active);
      tab.classList.toggle('hover:text-accent', !active);
    });
  }

  function setActionFlow(activeButton) {
    [els.validate, els.generate, els.copy].forEach(function (button) {
      var isActive = button === activeButton && !button.disabled;
      button.classList.toggle('border-accent', isActive);
      button.classList.toggle('bg-accent', isActive);
      button.classList.toggle('text-[#061014]', isActive);
      button.classList.toggle('shadow-control', isActive);
      button.classList.toggle('hover:bg-cyan-200', isActive);
      button.classList.toggle('border-white/15', !isActive);
      button.classList.toggle('bg-white/10', !isActive);
      button.classList.toggle('text-white', !isActive);
      button.classList.toggle('hover:border-accent', !isActive);
      button.classList.toggle('hover:text-accent', !isActive);
    });
  }

  function showError(message) {
    if (!els.error) return;
    els.error.textContent = message;
    els.error.classList.remove('hidden');
  }

  function clearError() {
    if (!els.error) return;
    els.error.textContent = '';
    els.error.classList.add('hidden');
  }

  function invalidateResults() {
    state.items = [];
    state.xml = '';
    els.generate.disabled = true;
    els.copy.disabled = true;
    els.output.value = '';
    setActionFlow(els.validate);
    renderSummary();
  }

  function validate() {
    if (!state.loaded) return;
    state.items = validateCountries(els.input.value, state.countries);
    state.xml = '';
    els.output.value = '';
    els.copy.disabled = true;
    els.generate.disabled = state.items.length === 0 || state.items.some(function (item) { return item.status !== 'valid'; });
    setActionFlow(els.generate.disabled ? els.validate : els.generate);
    renderSummary();
  }

  function generate() {
    if (state.items.length === 0 || state.items.some(function (item) { return item.status !== 'valid'; })) {
      return;
    }
    state.xml = buildFetchXml(state.items);
    els.output.value = state.xml;
    els.copy.disabled = false;
    setActionFlow(els.copy);
  }

  function copy() {
    navigator.clipboard.writeText(state.xml);
  }

  function clear() {
    els.input.value = '';
    state.items = [];
    state.xml = '';
    els.generate.disabled = true;
    els.copy.disabled = true;
    els.output.value = '';
    setActionFlow(els.validate);
    renderSummary();
  }

  function init() {
    if (!els.input) return;
    els.input.addEventListener('input', function () {
      invalidateResults();
    });
    els.validate.addEventListener('click', validate);
    els.generate.addEventListener('click', generate);
    els.copy.addEventListener('click', copy);
    els.clear.addEventListener('click', clear);
    els.summaryTab.addEventListener('click', function () { setActiveDetails('summary'); });
    els.warningsTab.addEventListener('click', function () { setActiveDetails('warnings'); });
    els.validate.disabled = true;
    setActionFlow(els.validate);
    fetch(MASTER_LIST_URL).then(function (response) {
      if (!response.ok) throw new Error('Country master list request failed.');
      return response.text();
    }).then(function (text) {
      state.countries = parseCsv(text);
      state.loaded = hasExpectedHeaders(text) && isValidMasterList(state.countries);
      els.validate.disabled = !state.loaded;
      setActionFlow(els.validate);
      if (state.loaded) {
        clearError();
      } else {
        showError('Country list is unavailable or has an invalid format.');
      }
    }).catch(function () {
      state.countries = [];
      state.loaded = false;
      els.validate.disabled = true;
      setActionFlow(els.validate);
      showError('Country list could not be loaded. Refresh the page and try again.');
    });
    renderSummary();
    setActiveDetails('summary');
  }

  init();
  window.Pattens = window.Pattens || {};
  window.Pattens.logic = { parseCsv: parseCsv, hasExpectedHeaders: hasExpectedHeaders, isValidMasterList: isValidMasterList, validateCountries: validateCountries, buildFetchXml: buildFetchXml };
}());
