/**
 * Tests for the Generate tool.
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const generatorCode = fs.readFileSync(path.join(__dirname, '..', 'generate.js'), 'utf8');

function setupGenerator() {
  document.body.innerHTML = `
    <button class="generator-type-tab" data-generator-type="Link"></button>
    <button class="generator-type-tab" data-generator-type="Campaign"></button>
    <button class="generator-type-tab" data-generator-type="Survey"></button>
    <form id="surveyGeneratorForm" class="hidden">
      <input id="surveyBaseUrl" value="https://emea.dcv.ms/GVMHka0Ltj">
      <select id="surveyLanguage"></select>
      <input id="surveyLob" value="Norican">
      <input id="surveyJourney" value="NO-Inquiry">
      <input id="surveyCampaign" value="NO-Inquiry">
      <input id="surveyContent" value="NO-Inquiry-EN">
      <input id="surveyMedium" value="Email">
      <output id="surveyPreview"></output>
      <p id="surveyFormError" class="hidden"></p>
    </form>
    <form id="linkGeneratorForm" class="hidden">
      <input id="linkBaseUrl" value="https://norican.com/contact">
      <input id="linkHighlightText">
      <button id="linkTrackingMtm" type="button" class="link-tracking-type-toggle" data-link-tracking-type="MTM" aria-pressed="true"></button>
      <button id="linkTrackingUtm" type="button" class="link-tracking-type-toggle" data-link-tracking-type="UTM" aria-pressed="false"></button>
      <input id="linkSource" value="CRM">
      <input id="linkMedium" value="Email">
      <input id="linkCampaign">
      <input id="linkContent">
      <input id="linkTerm">
      <input id="linkCrmCampaign">
      <output id="linkPreview"></output>
      <p id="linkFormError" class="hidden"></p>
    </form>
    <form id="campaignGeneratorForm">
      <input id="campaignBusiness" value="NO">
      <select id="campaignYear"></select>
      <select id="campaignRegion"></select>
      <select id="campaignLanguage"></select>
      <input id="campaignDescriptor">
      <input id="campaignSalesplay">
      <output id="campaignPreview"></output>
      <p id="campaignFormError" class="hidden"></p>
    </form>
    <div id="generatedItemsList" class="max-h-[318px] overflow-y-auto"></div>
    <span id="generatedItemCount"></span>
    <div id="generatorActions" class="grid grid-cols-2">
      <button id="generateItemButton"></button>
      <button id="validateGeneratorPreviewButton"></button>
      <button id="copyGeneratorPreviewButton"></button>
      <button id="clearGeneratedItemsButton"></button>
    </div>
    <p id="generatorStatusText" class="hidden"></p>
    <h2 id="generatorFormatTitle"></h2>
    <p id="generatorFormatDescription"></p>
  `;
  window.Pattens = {};
  (0, eval)(generatorCode);
  return window.Pattens.generator;
}

describe('Generate tool', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('builds a complete campaign code from selected values', () => {
    const generator = setupGenerator();
    expect(generator.state.activeType).toBe('Link');
    expect(generator.buildCampaignCode({
      business: 'NO',
      year: '26',
      region: 'WW',
      descriptor: 'Upgrade',
      salesplay: 'SP1',
      language: 'EN',
    })).toBe('NO-26-WW-Upgrade-SP1-EN');
  });

  test('omits optional region and language segments', () => {
    const generator = setupGenerator();
    expect(generator.buildCampaignCode({
      business: 'DI',
      year: '25',
      region: '',
      descriptor: 'Product launch',
      salesplay: 'SP2',
      language: '',
    })).toBe('DI-25-Product-launch-SP2');
  });

  test('builds a tracked link and uppercases non-URL values', () => {
    const generator = setupGenerator();
    expect(generator.buildLinkUrl({
      baseUrl: 'https://norican.com/contact',
      trackingType: 'MTM',
      source: 'crm',
      medium: 'Email',
      campaign: 'upgrade1',
      content: 'en',
      term: 'cta',
      crmCampaign: 'no-26-upgrade',
    })).toBe('https://norican.com/contact/?mtm_source=CRM&mtm_medium=EMAIL&mtm_campaign=UPGRADE1&mtm_content=EN&mtm_term=CTA&crm_campaign=NO-26-UPGRADE');
  });

  test('switches tracked link parameters to UTM when selected', () => {
    const generator = setupGenerator();
    expect(generator.buildLinkUrl({
      baseUrl: 'https://norican.com/contact',
      trackingType: 'UTM',
      source: 'crm',
      medium: 'Email',
      campaign: 'upgrade1',
      content: 'en',
      term: 'cta',
      crmCampaign: 'no-26-upgrade',
    })).toBe('https://norican.com/contact/?utm_source=CRM&utm_medium=EMAIL&utm_campaign=UPGRADE1&utm_content=EN&utm_term=CTA&crm_campaign=NO-26-UPGRADE');
  });

  test('builds a highlight URL without query parameters', () => {
    const generator = setupGenerator();
    expect(generator.buildHighlightUrl(
      'https://example.com/page',
      'Example'
    )).toBe('https://example.com/page#:~:text=Example');
  });

  test('builds a highlight URL after query parameters', () => {
    const generator = setupGenerator();
    expect(generator.buildHighlightUrl(
      'https://example.com/page?mtm_source=CRM',
      'Contact our sales team'
    )).toBe('https://example.com/page?mtm_source=CRM#:~:text=Contact%20our%20sales%20team');
  });

  test('returns empty highlight URL for empty highlight text', () => {
    const generator = setupGenerator();
    expect(generator.buildHighlightUrl('https://example.com/page', '   ')).toBe('');
  });

  test('replaces an existing text fragment', () => {
    const generator = setupGenerator();
    expect(generator.buildHighlightUrl(
      'https://example.com/page#:~:text=Old',
      'New text'
    )).toBe('https://example.com/page#:~:text=New%20text');
  });

  test('drops a normal hash anchor when building a highlight URL', () => {
    const generator = setupGenerator();
    expect(generator.buildHighlightUrl(
      'https://example.com/page#section',
      'Example'
    )).toBe('https://example.com/page#:~:text=Example');
  });

  test('encodes special characters in highlight text', () => {
    const generator = setupGenerator();
    expect(generator.buildHighlightUrl(
      'https://example.com/page',
      'Sales & service / support?'
    )).toBe('https://example.com/page#:~:text=Sales%20%26%20service%20%2F%20support%3F');
  });

  test('allows long highlight text in the preview without blocking generation', () => {
    setupGenerator();
    ['linkCampaign', 'linkCrmCampaign'].forEach(id => {
      document.getElementById(id).value = 'complete';
    });
    document.getElementById('linkHighlightText').value = 'a'.repeat(301);
    document.getElementById('linkGeneratorForm').dispatchEvent(new Event('input', { bubbles: true }));

    expect(document.getElementById('linkPreview').textContent).toContain('#:~:text=');
    expect(document.getElementById('generateItemButton').disabled).toBe(false);
  });

  test('updates the link preview and format copy when tracking type changes', () => {
    setupGenerator();

    ['linkCampaign', 'linkContent', 'linkTerm', 'linkCrmCampaign'].forEach(id => {
      document.getElementById(id).value = 'complete';
    });
    document.getElementById('linkTrackingUtm').click();

    expect(document.getElementById('linkPreview').textContent).toContain('utm_source=CRM');
    expect(document.getElementById('linkPreview').textContent).not.toContain('mtm_source=CRM');
    expect(document.getElementById('generatorFormatDescription').textContent).toContain('UTM');
    expect(document.getElementById('linkTrackingUtm').getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('linkTrackingMtm').getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('linkTrackingUtm').classList.contains('ring-1')).toBe(true);
    expect(document.getElementById('linkTrackingMtm').classList.contains('ring-1')).toBe(false);
  });

  test('generates, stores, and renders a tracked link', () => {
    const generator = setupGenerator();
    generator.setActiveType('Link');
    document.getElementById('linkCampaign').value = 'upgrade1';
    document.getElementById('linkContent').value = 'en';
    document.getElementById('linkTerm').value = 'cta';
    document.getElementById('linkCrmCampaign').value = 'no-26-upgrade';

    document.getElementById('linkGeneratorForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(generator.state.items).toHaveLength(1);
    expect(generator.state.items[0].type).toBe('Link');
    expect(generator.state.items[0].value).toContain('mtm_medium=EMAIL');
    expect(JSON.parse(window.localStorage.getItem(generator.storageKey))).toHaveLength(1);
    expect(document.getElementById('generatedItemsList').textContent).toContain('norican.com/contact');
    expect(document.querySelector('[data-saved-result]').classList.contains('truncate')).toBe(true);
    expect(document.querySelector('[data-saved-result]').getAttribute('title')).toBe(generator.state.items[0].value);
  });

  test('generates and renders highlight link history metadata', () => {
    const generator = setupGenerator();
    generator.setActiveType('Link');
    document.getElementById('linkCampaign').value = 'upgrade1';
    document.getElementById('linkContent').value = 'en';
    document.getElementById('linkTerm').value = 'cta';
    document.getElementById('linkCrmCampaign').value = 'no-26-upgrade';
    document.getElementById('linkHighlightText').value = 'Contact our sales team';

    document.getElementById('linkGeneratorForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(generator.state.items).toHaveLength(1);
    expect(generator.state.items[0].value).toContain('#:~:text=Contact%20our%20sales%20team');
    expect(generator.state.items[0].fields.usedHighlightLink).toBe(true);
    expect(generator.state.items[0].fields.highlightText).toBe('Contact our sales team');
    expect(document.getElementById('generatedItemsList').textContent).toContain('HIGHLIGHT');
    expect(document.querySelector('[data-saved-highlight]').textContent).toBe('Contact our sales team');
  });

  test('enables Generate, Validate, and Copy only when every link field is complete', () => {
    setupGenerator();
    const button = document.getElementById('generateItemButton');
    const validateButton = document.getElementById('validateGeneratorPreviewButton');
    const copyButton = document.getElementById('copyGeneratorPreviewButton');
    const form = document.getElementById('linkGeneratorForm');

    expect(button.disabled).toBe(true);
    expect(validateButton.disabled).toBe(true);
    expect(copyButton.disabled).toBe(true);

    ['linkCampaign', 'linkContent', 'linkTerm', 'linkCrmCampaign'].forEach(id => {
      document.getElementById(id).value = 'complete';
    });
    form.dispatchEvent(new Event('input', { bubbles: true }));
    expect(button.disabled).toBe(false);
    expect(validateButton.disabled).toBe(false);
    expect(copyButton.disabled).toBe(false);

    document.getElementById('linkHighlightText').value = 'Contact our sales team';
    form.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.getElementById('linkPreview').textContent).toContain('#:~:text=Contact%20our%20sales%20team');

    document.getElementById('linkBaseUrl').value = '';
    form.dispatchEvent(new Event('input', { bubbles: true }));
    expect(button.disabled).toBe(true);
    expect(validateButton.disabled).toBe(true);
    expect(copyButton.disabled).toBe(true);
    expect(document.getElementById('linkFormError').textContent).toBe('');
  });

  test('keeps link actions disabled when the editable URL is invalid', () => {
    setupGenerator();
    const button = document.getElementById('generateItemButton');
    const validateButton = document.getElementById('validateGeneratorPreviewButton');
    const copyButton = document.getElementById('copyGeneratorPreviewButton');
    const form = document.getElementById('linkGeneratorForm');

    ['linkCampaign', 'linkContent', 'linkTerm', 'linkCrmCampaign'].forEach(id => {
      document.getElementById(id).value = 'complete';
    });
    document.getElementById('linkBaseUrl').value = 'not a url';
    form.dispatchEvent(new Event('input', { bubbles: true }));

    expect(document.getElementById('linkPreview').textContent).toBe('Link preview');
    expect(button.disabled).toBe(true);
    expect(validateButton.disabled).toBe(true);
    expect(copyButton.disabled).toBe(true);
  });

  test('copies the highlighted link from the normal preview copy button', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    setupGenerator();

    ['linkCampaign', 'linkContent', 'linkTerm', 'linkCrmCampaign'].forEach(id => {
      document.getElementById(id).value = 'complete';
    });
    document.getElementById('linkHighlightText').value = 'Contact our sales team';
    document.getElementById('linkGeneratorForm').dispatchEvent(new Event('input', { bubbles: true }));

    document.getElementById('copyGeneratorPreviewButton').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('#:~:text=Contact%20our%20sales%20team'));
  });

  test('updates action availability for Campaign and Survey', () => {
    const generator = setupGenerator();
    const generateButton = document.getElementById('generateItemButton');
    const validateButton = document.getElementById('validateGeneratorPreviewButton');
    const copyButton = document.getElementById('copyGeneratorPreviewButton');

    generator.setActiveType('Campaign');
    expect(generateButton.disabled).toBe(true);
    expect(validateButton.disabled).toBe(true);
    expect(validateButton.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('clearGeneratedItemsButton').classList.contains('col-span-2')).toBe(true);
    expect(copyButton.disabled).toBe(true);

    document.getElementById('campaignDescriptor').value = 'Upgrade';
    document.getElementById('campaignSalesplay').value = 'SP1';
    document.getElementById('campaignGeneratorForm').dispatchEvent(new Event('input', { bubbles: true }));
    expect(generateButton.disabled).toBe(false);
    expect(validateButton.disabled).toBe(true);
    expect(copyButton.disabled).toBe(false);

    generator.setActiveType('Survey');
    expect(generateButton.disabled).toBe(false);
    expect(validateButton.disabled).toBe(false);
    expect(validateButton.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('clearGeneratedItemsButton').classList.contains('col-span-2')).toBe(false);
    expect(copyButton.disabled).toBe(false);

    document.getElementById('surveyJourney').value = '';
    document.getElementById('surveyGeneratorForm').dispatchEvent(new Event('input', { bubbles: true }));
    expect(generateButton.disabled).toBe(true);
    expect(validateButton.disabled).toBe(true);
    expect(copyButton.disabled).toBe(true);
  });

  test('opens complete Link and Survey preview URLs in a new tab', () => {
    const generator = setupGenerator();
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const validateButton = document.getElementById('validateGeneratorPreviewButton');

    ['linkCampaign', 'linkContent', 'linkTerm', 'linkCrmCampaign'].forEach(id => {
      document.getElementById(id).value = 'complete';
    });
    document.getElementById('linkGeneratorForm').dispatchEvent(new Event('input', { bubbles: true }));
    validateButton.click();

    expect(openSpy).toHaveBeenLastCalledWith(
      expect.stringContaining('https://norican.com/contact/?mtm_source=CRM'),
      '_blank',
      'noopener,noreferrer'
    );

    generator.setActiveType('Survey');
    validateButton.click();
    expect(openSpy).toHaveBeenLastCalledWith(
      expect.stringContaining('https://emea.dcv.ms/GVMHka0Ltj&lang=en-us&ctx='),
      '_blank',
      'noopener,noreferrer'
    );
    expect(openSpy).toHaveBeenCalledTimes(2);

    openSpy.mockRestore();
  });

  test('builds the encoded survey URL with normalized context values', () => {
    const generator = setupGenerator();
    expect(generator.buildSurveyUrl({
      baseUrl: 'https://emea.dcv.ms/GVMHka0Ltj',
      lang: 'en-us',
      journey: 'NO-Inquiry',
      lob: 'Norican',
      campaign: 'NO-Inquiry',
      content: 'NO-Inquiry-EN',
      medium: 'Email',
    })).toBe('https://emea.dcv.ms/GVMHka0Ltj&lang=en-us&ctx=%7B%22journey%22%3A%22no-inquiry%22%2C%22lob%22%3A%22Norican%22%2C%22source%22%3A%22CRM%22%2C%22campaign%22%3A%22no-inquiry%22%2C%22medium%22%3A%22Email%22%2C%22content%22%3A%22no-inquiry-en%22%7D');
  });

  test('generates, stores, and renders a survey URL', () => {
    const generator = setupGenerator();
    generator.setActiveType('Survey');
    document.getElementById('surveyGeneratorForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(generator.state.items).toHaveLength(1);
    expect(generator.state.items[0].type).toBe('Survey');
    expect(generator.state.items[0].value).toContain('&lang=en-us&ctx=');
    expect(generator.state.items[0].value).toContain('%22source%22%3A%22CRM%22');
    expect(JSON.parse(window.localStorage.getItem(generator.storageKey))).toHaveLength(1);
    expect(document.getElementById('generatedItemsList').textContent).toContain('emea.dcv.ms/GVMHka0Ltj');
  });

  test('generates, stores, and renders a campaign', () => {
    const generator = setupGenerator();
    document.getElementById('campaignRegion').value = 'WW';
    document.getElementById('campaignLanguage').value = 'EN';
    document.getElementById('campaignDescriptor').value = 'Upgrade';
    document.getElementById('campaignSalesplay').value = 'SP1';

    document.getElementById('campaignGeneratorForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(generator.state.items).toHaveLength(1);
    expect(generator.state.items[0].value).toBe('NO-26-WW-Upgrade-SP1-EN');
    expect(JSON.parse(window.localStorage.getItem(generator.storageKey))).toHaveLength(1);
    expect(document.getElementById('generatedItemsList').textContent).toContain('NO-26-WW-Upgrade-SP1-EN');
    expect(document.getElementById('generatorStatusText').textContent).toBe('');
  });

  test('loads saved campaigns and links from local storage on initialization', () => {
    window.localStorage.setItem('pattens.generate.items.v1', JSON.stringify([
      {
        id: 'saved-1',
        type: 'Campaign',
        value: 'WB-26-NAM-Service-SP3-EN',
        fields: {},
        createdAt: '2026-06-19T05:00:00.000Z',
      },
      {
        id: 'saved-2',
        type: 'Link',
        value: 'https://norican.com/contact/?mtm_source=CRM',
        fields: {},
        createdAt: '2026-06-19T05:01:00.000Z',
      },
      {
        id: 'saved-3',
        type: 'Survey',
        value: 'https://emea.dcv.ms/GVMHka0Ltj&lang=en-us&ctx=%7B%7D',
        fields: {},
        createdAt: '2026-06-19T05:02:00.000Z',
      },
    ]));

    const generator = setupGenerator();
    expect(generator.state.items).toHaveLength(3);
    expect(document.getElementById('generatedItemsList').textContent).toContain('WB-26-NAM-Service-SP3-EN');
    expect(document.getElementById('generatedItemsList').textContent).toContain('norican.com/contact');
    expect(document.getElementById('generatedItemsList').textContent).toContain('emea.dcv.ms/GVMHka0Ltj');
    expect(document.getElementById('generatedItemsList').textContent).toContain('Load more');
    expect(document.querySelector('[data-saved-type="Link"] [data-saved-title]').classList.contains('text-sky-300')).toBe(true);
    expect(document.querySelector('[data-saved-type="Campaign"] [data-saved-title]').classList.contains('text-emerald-300')).toBe(true);
    expect(document.querySelector('[data-saved-type="Survey"] [data-saved-title]').classList.contains('text-purple-300')).toBe(true);
  });

  test('does not save or show an error when required campaign fields are missing', () => {
    const generator = setupGenerator();
    document.getElementById('campaignGeneratorForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(generator.state.items).toHaveLength(0);
    expect(document.getElementById('campaignFormError').textContent).toBe('');
  });
});
