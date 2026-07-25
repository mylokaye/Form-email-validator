/**
 * Tests for the Email Validator functions.
 *
 * Loads the real source from src/validator/validator.js
 * and tests against it — no inline copies.
 *
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Load the real validator source (same eval pattern as app.test.js and generator.test.js)
const validatorCode = fs.readFileSync(
  path.join(__dirname, '..', '..', 'legacy-static', 'src', 'validator', 'validator.js'),
  'utf-8'
);
const indexHtml = fs.readFileSync(path.join(__dirname, '..', '..', 'legacy-static', 'index.html'), 'utf-8');
(0, eval)(validatorCode);

// Convenience aliases from the Pattens namespace
const V = window.Pattens.validator;
const sanitizeEmail = V.sanitizeEmail;
const isValidEmailSyntax = V.isValidEmailSyntax;
const extractEmailsFromText = V.extractEmailsFromText;
const parseCSV = V.parseCSV;
const validateEmails = V.validateEmails;

describe('isValidEmailSyntax', () => {
  test('validates a standard email', () => {
    expect(isValidEmailSyntax('user@example.com')).toBe(true);
  });

  test('validates email with plus sign', () => {
    expect(isValidEmailSyntax('user+tag@example.com')).toBe(true);
  });

  test('validates email with subdomain', () => {
    expect(isValidEmailSyntax('user@mail.example.co.uk')).toBe(true);
  });

  test('rejects email without @', () => {
    expect(isValidEmailSyntax('userexample.com')).toBe(false);
  });

  test('rejects email with multiple @', () => {
    expect(isValidEmailSyntax('user@@example.com')).toBe(false);
  });

  test('rejects email with consecutive dots', () => {
    expect(isValidEmailSyntax('user..name@example.com')).toBe(false);
  });

  test('rejects email with leading dot in local part', () => {
    expect(isValidEmailSyntax('.user@example.com')).toBe(false);
  });

  test('rejects email with trailing dot in local part', () => {
    expect(isValidEmailSyntax('user.@example.com')).toBe(false);
  });

  test('rejects email with invalid characters', () => {
    expect(isValidEmailSyntax('user name@example.com')).toBe(false);
  });

  test('rejects email exceeding max length', () => {
    const longLocal = 'a'.repeat(65);
    expect(isValidEmailSyntax(`${longLocal}@example.com`)).toBe(false);
  });

  test('rejects email with empty domain', () => {
    expect(isValidEmailSyntax('user@')).toBe(false);
  });

  test('rejects email with domain starting with dot', () => {
    expect(isValidEmailSyntax('user@.example.com')).toBe(false);
  });

  test('rejects email with domain starting with hyphen', () => {
    expect(isValidEmailSyntax('user@-example.com')).toBe(false);
  });

  test('rejects null/undefined', () => {
    expect(isValidEmailSyntax(null)).toBe(false);
    expect(isValidEmailSyntax(undefined)).toBe(false);
  });

  test('rejects non-string', () => {
    expect(isValidEmailSyntax(123)).toBe(false);
  });

  test('rejects email with non-alpha TLD', () => {
    expect(isValidEmailSyntax('user@example.123')).toBe(false);
  });

  test('rejects email with TLD too short', () => {
    expect(isValidEmailSyntax('user@example.a')).toBe(false);
  });
});

describe('sanitizeEmail', () => {
  test('removes dangerous characters', () => {
    expect(sanitizeEmail('<user@example.com>')).toBe('user@example.com');
    expect(sanitizeEmail('user@example.com"')).toBe('user@example.com');
    expect(sanitizeEmail("user'@example.com")).toBe('user@example.com');
  });

  test('trims whitespace', () => {
    expect(sanitizeEmail('  user@example.com  ')).toBe('user@example.com');
  });

  test('removes newlines and tabs', () => {
    expect(sanitizeEmail('user@example.com\r\n')).toBe('user@example.com');
  });

  test('handles empty input', () => {
    expect(sanitizeEmail('')).toBe('');
  });
});

describe('extractEmailsFromText', () => {
  test('extracts emails from newline-separated text', () => {
    const result = extractEmailsFromText(
      'user@example.com\nother@test.com'
    );
    expect(result).toEqual(['user@example.com', 'other@test.com']);
  });

  test('extracts emails from CSV', () => {
    const result = extractEmailsFromText(
      'user@example.com,other@test.com'
    );
    expect(result).toEqual(['user@example.com', 'other@test.com']);
  });

  test('handles quoted CSV fields', () => {
    const result = extractEmailsFromText(
      '"user@example.com","other@test.com"'
    );
    expect(result).toEqual(['user@example.com', 'other@test.com']);
  });

  test('skips empty lines', () => {
    const result = extractEmailsFromText(
      'user@example.com\n\nother@test.com\n'
    );
    expect(result).toEqual(['user@example.com', 'other@test.com']);
  });

  test('handles empty input', () => {
    const result = extractEmailsFromText('');
    expect(result).toEqual([]);
  });
});

describe('validateEmails', () => {
  test('counts valid and invalid emails', () => {
    const result = validateEmails([
      'user@example.com',
      'invalid@@example.com',
      'another@test.com',
    ]);
    expect(result.summary.valid).toBe(2);
    expect(result.summary.invalid).toBe(1);
    expect(result.summary.total).toBe(3);
  });

  test('detects duplicates', () => {
    const result = validateEmails([
      'user@example.com',
      'user@example.com',
      'USER@EXAMPLE.COM',
    ]);
    expect(result.summary.duplicate).toBe(2);
    expect(result.summary.valid).toBe(1);
  });

  test('calculates valid rate', () => {
    const result = validateEmails([
      'user@example.com',
      'invalid',
      'other@test.com',
    ]);
    expect(result.summary.validRate).toBe(67); // 2/3 rounded
  });

  test('returns 0 rate for empty input', () => {
    const result = validateEmails([]);
    expect(result.summary.validRate).toBe(0);
  });

  test('assigns correct status to each email', () => {
    const result = validateEmails(['good@example.com', 'bad@@example.com']);
    expect(result.emails[0].status).toBe('Valid');
    expect(result.emails[1].status).toBe('Invalid');
  });
});

describe('parseCSV', () => {
  test('parses simple CSV', () => {
    const result = parseCSV('a,b,c\nd,e,f');
    expect(result).toEqual([['a', 'b', 'c'], ['d', 'e', 'f']]);
  });

  test('handles quoted fields with commas', () => {
    const result = parseCSV('"Hello, World",test');
    expect(result).toEqual([['Hello, World', 'test']]);
  });

  test('handles escaped quotes', () => {
    const result = parseCSV('"She said ""hi""",ok');
    expect(result).toEqual([['She said "hi"', 'ok']]);
  });

  test('handles empty input', () => {
    const result = parseCSV('');
    expect(result).toEqual([]);
  });
});

describe('validator page integration', () => {
  test('loads sample emails without automatically validating them', () => {
    const sampleStart = indexHtml.indexOf('function loadValidatorSample()');
    const sampleEnd = indexHtml.indexOf('async function loadValidatorUploadedFile', sampleStart);
    const sampleFunction = indexHtml.slice(sampleStart, sampleEnd);

    expect(sampleFunction).toContain('updateValidatorInputCount();');
    expect(sampleFunction).not.toContain('validateCurrentInput();');
  });

  test('always clears the validating status', () => {
    expect(indexHtml).toMatch(/finally\s*{\s*setValidatorStatus\(""\);\s*}/);
  });
});
