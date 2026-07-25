(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────
  var MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  var MAX_EMAILS = 300;
  var MAX_EMAIL_LENGTH = 254;
  var MAX_LOCAL_PART_LENGTH = 64;

  // ── Core functions ──────────────────────────────────────────

  /**
   * Sanitize an email string by removing dangerous characters and whitespace.
   * @param {*} email - Raw email input
   * @returns {string} Sanitized email string
   */
  function sanitizeEmail(email) {
    return String(email || '')
      .replace(/[<>"';\\]/g, '')
      .replace(/[\r\n\t]/g, '')
      .trim();
  }

  /**
   * Validate email syntax according to RFC-like rules.
   * Checks length, @ count, local part, domain, and TLD validity.
   * @param {*} email - Email string to validate
   * @returns {boolean} True if the email passes syntax checks
   */
  function isValidEmailSyntax(email) {
    if (!email || typeof email !== 'string') return false;
    if (email.length > MAX_EMAIL_LENGTH) return false;
    if ((email.match(/@/g) || []).length !== 1) return false;
    if (email.includes('..')) return false;

    var parts = email.split('@');
    var localPart = parts[0];
    var domainPart = parts[1];

    if (!localPart || !domainPart) return false;
    if (localPart.length > MAX_LOCAL_PART_LENGTH) return false;
    if (!/^[a-zA-Z0-9._+-]+$/.test(localPart)) return false;
    if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
    if (!domainPart.includes('.')) return false;
    if (!/^[a-zA-Z0-9.-]+$/.test(domainPart)) return false;
    if (domainPart.startsWith('.') || domainPart.endsWith('.')) return false;
    if (domainPart.startsWith('-') || domainPart.endsWith('-')) return false;

    var labels = domainPart.split('.');
    if (labels.some(function (label) { return !label || label.startsWith('-') || label.endsWith('-'); })) return false;

    var tld = labels[labels.length - 1];
    return /^[a-zA-Z]{2,63}$/.test(tld);
  }

  /**
   * Parse CSV text into a 2D array of fields.
   * Handles quoted fields, escaped quotes, and multi-line fields.
   * @param {string} text - Raw CSV text
   * @returns {string[][]} Array of rows, each containing field values
   */
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var char = text[i];
      var next = text[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(field);
        field = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i++;
        row.push(field);
        if (row.some(function (value) { return value.trim() !== ''; })) rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }

    row.push(field);
    if (row.some(function (value) { return value.trim() !== ''; })) rows.push(row);
    return rows;
  }

  /**
   * Extract email addresses from raw text (CSV, newline-separated, or semicolon-separated).
   * Each field is split on whitespace and semicolons, then sanitized.
   * @param {string} text - Raw input text containing emails
   * @returns {string[]} Array of extracted email strings
   */
  function extractEmailsFromText(text) {
    var rows = parseCSV(text);
    var emails = [];

    rows.forEach(function (row) {
      row.forEach(function (field) {
        String(field)
          .split(/[\s;]+/)
          .map(function (value) { return sanitizeEmail(value); })
          .filter(Boolean)
          .forEach(function (candidate) { emails.push(candidate); });
      });
    });

    return emails;
  }

  /**
   * Validate a list of email addresses, detecting duplicates and invalid syntax.
   * @param {string[]} emails - Array of email strings to validate
   * @returns {{ summary: object, emails: object[] }} Validation result with summary and per-email details
   */
  function validateEmails(emails) {
    var seen = new Set();
    var emailResults = [];
    var validCount = 0;
    var invalidCount = 0;
    var duplicateCount = 0;

    emails.forEach(function (email) {
      var normalized = email.toLowerCase();

      if (seen.has(normalized)) {
        duplicateCount++;
        emailResults.push({
          email: email,
          status: 'Duplicate',
          valid: false
        });
        return;
      }

      seen.add(normalized);
      var valid = isValidEmailSyntax(email);

      if (valid) {
        validCount++;
      } else {
        invalidCount++;
      }

      emailResults.push({
        email: email,
        status: valid ? 'Valid' : 'Invalid',
        valid: valid
      });
    });

    var checkedTotal = validCount + invalidCount;
    var validRate = checkedTotal > 0 ? Math.round((validCount / checkedTotal) * 100) : 0;

    return {
      summary: {
        total: emailResults.length,
        checked: checkedTotal,
        valid: validCount,
        invalid: invalidCount,
        duplicate: duplicateCount,
        validRate: validRate
      },
      emails: emailResults
    };
  }

  // ── Public API ───────────────────────────────────────────────
  var api = {
    MAX_FILE_SIZE: MAX_FILE_SIZE,
    MAX_EMAILS: MAX_EMAILS,
    MAX_EMAIL_LENGTH: MAX_EMAIL_LENGTH,
    MAX_LOCAL_PART_LENGTH: MAX_LOCAL_PART_LENGTH,
    sanitizeEmail: sanitizeEmail,
    isValidEmailSyntax: isValidEmailSyntax,
    parseCSV: parseCSV,
    extractEmailsFromText: extractEmailsFromText,
    validateEmails: validateEmails
  };

  // Attach to global Pattens namespace (consistent with app.js and generate.js)
  window.Pattens = window.Pattens || {};
  window.Pattens.validator = api;

  // Support CommonJS for Jest tests
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
