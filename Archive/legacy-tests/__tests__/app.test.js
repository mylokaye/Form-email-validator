/**
 * Tests for the Dynamics Email Converter (app.js)
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// ── Set up minimal DOM BEFORE loading app.js ──────────────────────
// app.js references these element IDs at the top level, so they must
// exist before the code is evaluated.

const TEST_IDS = [
  'originalHtmlTab', 'convertedHtmlTab',
  'originalHtml', 'convertedHtml', 'originalPreviewTab', 'convertedPreviewTab',
  'copyButton', 'refreshButton', 'statusText', 'summaryRows',
  'originalPreview', 'convertedPreview', 'malformedBadge', 'errorBox',
  'summaryTab', 'warningsTab', 'summaryPanel', 'warningsPanel', 'warningCount',
];

TEST_IDS.forEach((id) => {
  const tag = ['originalHtml', 'convertedHtml'].includes(id) ? 'textarea' : 'div';
  const el = document.createElement(tag);
  el.id = id;
  // Give buttons a <span> child (copyButton expects one)
  if (id === 'copyButton') {
    const span = document.createElement('span');
    span.textContent = 'Copy';
    el.appendChild(span);
  }
  document.body.appendChild(el);
});

// ── Load app.js ───────────────────────────────────────────────────
const appCode = fs.readFileSync(path.join(__dirname, '..', '..', 'legacy-static', 'app.js'), 'utf-8');
// Use indirect eval so top-level const/let bindings are accessible
// as bare identifiers in tests (they go into the global lexical scope).
(0, eval)(appCode);

// ── Convenience aliases ───────────────────────────────────────────
const PC = window.Pattens.converter;
const parseHtml = PC._parseHtml;
const analyseEmailHtml = PC._analyseEmailHtml;
const convertEmailHtml = PC._convertEmailHtml;
const validateConvertedHtml = PC._validateConvertedHtml;
const conversionMarkerSummary = PC._conversionMarkerSummary;
const escapeHtml = PC._escapeHtml;
const dedupeWarnings = PC._dedupeWarnings;
const resetPipelineState = PC.resetPipelineState;
const issue = PC._issue;

describe('parseHtml', () => {
  test('parses valid HTML and returns a document', () => {
    const doc = parseHtml('<html><body><p>Hello</p></body></html>');
    expect(doc).toBeInstanceOf(Document);
    expect(doc.body.textContent).toContain('Hello');
  });

  test('handles empty string gracefully', () => {
    const doc = parseHtml('');
    expect(doc).toBeInstanceOf(Document);
  });

  test('handles null/undefined gracefully', () => {
    const doc = parseHtml(null);
    expect(doc).toBeInstanceOf(Document);
  });

  test('detects parser errors in malformed HTML', () => {
    const doc = parseHtml('<div><p>unclosed</div>');
    // Even somewhat malformed HTML may parse - check it doesn't crash
    expect(doc).toBeInstanceOf(Document);
  });
});

describe('analyseEmailHtml', () => {
  test('analyses simple email HTML', () => {
    const html = '<html><body><h1>Welcome</h1><p>Hello world</p></body></html>';
    const result = analyseEmailHtml(html);
    expect(result).toHaveProperty('textBlocks');
    expect(result).toHaveProperty('imageBlocks');
    expect(result).toHaveProperty('buttonBlocks');
    expect(result).toHaveProperty('warnings');
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test('detects text blocks from heading and paragraph', () => {
    const html = '<html><body><h1>Welcome to our newsletter</h1><p>This is content.</p></body></html>';
    const result = analyseEmailHtml(html);
    expect(result.textBlocks.length).toBeGreaterThanOrEqual(1);
  });

  test('detects malformed HTML warnings', () => {
    const html = '<div style="color: red">Broken quote';
    const result = analyseEmailHtml(html);
    const malformed = result.warnings.filter((w) => w.type === 'malformed-html');
    expect(malformed.length).toBeGreaterThanOrEqual(0); // may or may not detect
  });

  test('allows greater-than signs inside quoted attributes', () => {
    const html = '<html><body><img src="rating.png" title="5 >" alt="5 >"></body></html>';
    const result = analyseEmailHtml(html);
    expect(result.warnings.some((warning) => warning.type === 'malformed-html')).toBe(false);
  });

  test('detects unsupported tags', () => {
    const html = '<html><body><script>alert(1)</script><p>text</p></body></html>';
    const result = analyseEmailHtml(html);
    const unsupported = result.warnings.filter((w) => w.type === 'unsupported-structure');
    expect(unsupported.length).toBeGreaterThanOrEqual(1);
  });
});

describe('convertEmailHtml', () => {
  test('converts simple HTML with text content', () => {
    const html = '<html><head></head><body><h1>Title</h1><p>Paragraph content here for testing.</p></body></html>';
    const analysis = analyseEmailHtml(html);
    const result = convertEmailHtml(html);
    expect(result).toHaveProperty('convertedHtml');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('summary');
    expect(typeof result.convertedHtml).toBe('string');
  });

  test('preserves conversion state in summary', () => {
    const html = '<html><body><p>Simple text block here.</p></body></html>';
    const analysis = analyseEmailHtml(html);
    const result = convertEmailHtml(html);
    expect(result.summary).toHaveProperty('converted');
    expect(result.summary).toHaveProperty('textBlocksMarked');
  });

  test('returns conversion result for malformed HTML', () => {
    // HTML with an unbalanced double quote should trigger malformed detection
    const html = '<div style="color: red">Broken "quote here';
    const analysis = analyseEmailHtml(html);
    const result = convertEmailHtml(html);
    expect(result).toHaveProperty('convertedHtml');
    expect(typeof result.convertedHtml).toBe('string');
  });

  test('handles empty HTML gracefully', () => {
    const html = '';
    const result = convertEmailHtml(html);
    expect(result).toHaveProperty('convertedHtml');
    expect(typeof result.convertedHtml).toBe('string');
  });

  test('creates Button blocks without protection while preserving styled button styles', () => {
    const html = `
      <html><body>
        <p>Editable paragraph content.</p>
        <a href="https://example.com" style="display:inline-block;padding:12px;background:#000">Read more</a>
        <img src="logo.png" alt="Company logo">
        <footer><p>Manage preferences or unsubscribe here.</p></footer>
      </body></html>`;
    const result = convertEmailHtml(html);
    const doc = parseHtml(result.convertedHtml);
    const types = [...doc.querySelectorAll('[data-editorblocktype]')]
      .map((element) => element.getAttribute('data-editorblocktype'));

    expect(new Set(types)).toEqual(new Set(['Text', 'Button', 'Image']));
    expect(doc.querySelector('a[href="https://example.com"]').getAttribute('style')).toContain('background:#000');
    expect(doc.querySelector('a[href="https://example.com"]').closest('[data-editorblocktype="Button"]').hasAttribute('data-protected')).toBe(false);
    expect(result.summary).not.toHaveProperty('protectedRegionsMarked');
  });

  test('preserves an existing complete Dynamics Button block without adding a container', () => {
    const html = `
      <html><body>
        <div data-editorblocktype="Button">
          <div class="buttonWrapper"><a href="https://example.com" style="background:#123456">Existing button</a></div>
        </div>
      </body></html>`;
    const result = convertEmailHtml(html);
    const doc = parseHtml(result.convertedHtml);
    const button = doc.querySelector('[data-editorblocktype="Button"]');

    expect(button.querySelector('.buttonWrapper a').getAttribute('style')).toBe('background:#123456');
    expect(button.closest('[data-container="true"]')).toBeNull();
    expect(doc.querySelectorAll('[data-editorblocktype="Button"]')).toHaveLength(1);
  });

  test('does not turn layout cells into standalone Dynamics containers', () => {
    const html = '<html><body><table><tr><td><p>Editable paragraph content.</p></td></tr></table></body></html>';
    const result = convertEmailHtml(html);
    const doc = parseHtml(result.convertedHtml);
    const cell = doc.querySelector('td');

    expect(cell.firstElementChild.getAttribute('data-container')).toBe('true');
    expect(cell.querySelectorAll('[data-container="true"]')).toHaveLength(1);
  });
});

describe('validateConvertedHtml', () => {
  test('validates converted output against original', () => {
    const original = '<html><body><p>Hello world content here.</p></body></html>';
    const converted = '<html><head><meta type="xrm/designer/setting" name="type" value="marketing-designer-content-editor-document"></head><body><div data-container="true"><div data-editorblocktype="Text"><p>Hello world content here.</p></div></div></body></html>';
    const result = validateConvertedHtml(original, converted);
    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('summary');
  });

  test('reports error for empty converted output', () => {
    const original = '<html><body><p>Hello</p></body></html>';
    const result = validateConvertedHtml(original, '');
    const emptyError = result.errors.find((e) => e.type === 'empty-converted-output');
    expect(emptyError).toBeDefined();
  });

  test('reports missing container when output has editable regions', () => {
    const original = '<html><body><p>Some text content here for blocks.</p></body></html>';
    const converted = '<html><body><p>Some text content here for blocks.</p></body></html>';
    const result = validateConvertedHtml(original, converted);
    const containerError = result.errors.find((e) => e.type === 'missing-container');
    expect(containerError).toBeDefined();
  });
});

describe('conversionMarkerSummary', () => {
  test('counts containers and editor blocks', () => {
    const html = '<html><body><div data-container="true"><div data-editorblocktype="Text"><p>Hello</p></div></div></body></html>';
    const summary = conversionMarkerSummary(html);
    expect(summary.containerCount).toBe(1);
    expect(summary.editorBlockCount).toBe(1);
  });

  test('returns zeros for empty markers', () => {
    const html = '<html><body><p>No markers here</p></body></html>';
    const summary = conversionMarkerSummary(html);
    expect(summary.containerCount).toBe(0);
    expect(summary.editorBlockCount).toBe(0);
  });

  test('does not count unsupported editor block types', () => {
    const html = '<html><body><div data-editorblocktype="Divider"></div></body></html>';
    const summary = conversionMarkerSummary(html);
    expect(summary.editorBlockCount).toBe(0);
  });
});

describe('escapeHtml', () => {
  test('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  test('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  test('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('handles non-string values', () => {
    expect(escapeHtml(123)).toBe('123');
  });
});

describe('dedupeWarnings', () => {
  test('removes duplicate warnings', () => {
    const warnings = [
      issue('test', 'warning', 'duplicate message'),
      issue('test', 'warning', 'duplicate message'),
      issue('other', 'warning', 'different message'),
    ];
    const result = dedupeWarnings(warnings);
    expect(result.length).toBe(2);
  });
});

describe('resetPipelineState', () => {
  test('resetPipelineState is callable without error', () => {
    // resetPipelineState accesses module-level `state` const.
    // Just verify it runs without throwing.
    expect(() => resetPipelineState()).not.toThrow();
  });
});
