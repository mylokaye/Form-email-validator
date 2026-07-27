export const MAX_FILE_SIZE = 1024 * 1024;
export const MAX_INPUT_LENGTH = MAX_FILE_SIZE;
export const MAX_EMAILS = 300;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_LOCAL_PART_LENGTH = 64;

export type ValidationStatus = 'Valid' | 'Invalid' | 'Duplicate';

export type EmailResult = {
  email: string;
  status: ValidationStatus;
  valid: boolean;
};

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com', 'dispostable.com', 'fakeinbox.com', 'getnada.com', 'guerrillamail.com', 'maildrop.cc', 'mailinator.com',
  'sharklasers.com', 'tempmail.com', 'temp-mail.org', 'throwawaymail.com', 'trashmail.com', 'yopmail.com',
]);

const ROLE_LOCAL_PARTS = new Set([
  'abuse', 'admin', 'billing', 'careers', 'contact', 'enquiries', 'hello', 'help', 'hr', 'info', 'legal', 'marketing', 'media', 'office', 'press', 'privacy', 'sales', 'security', 'support', 'team',
]);

const DOMAIN_TYPOS: Record<string, string> = {
  'gamil.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gmial.com': 'gmail.com',
  'hotnail.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'iclould.com': 'icloud.com', 'outlook.con': 'outlook.com',
  'protonnmail.com': 'protonmail.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com',
};

export type ValidationSummary = {
  total: number;
  checked: number;
  valid: number;
  invalid: number;
  duplicate: number;
  validRate: number;
  mxValidated: number;
};

export function sanitizeEmail(email: unknown) {
  return String(email ?? '')
    .replace(/[<>"';\\]/g, '')
    .replace(/[\r\n\t]/g, '')
    .trim();
}

export function isValidEmailSyntax(email: unknown) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > MAX_EMAIL_LENGTH) return false;
  if ((email.match(/@/g) ?? []).length !== 1 || email.includes('..')) return false;

  const [localPart, domainPart] = email.split('@');
  if (!localPart || !domainPart || localPart.length > MAX_LOCAL_PART_LENGTH) return false;
  if (!/^[a-zA-Z0-9._+-]+$/.test(localPart)) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (!domainPart.includes('.') || !/^[a-zA-Z0-9.-]+$/.test(domainPart)) return false;
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) return false;
  if (domainPart.startsWith('-') || domainPart.endsWith('-')) return false;

  const labels = domainPart.split('.');
  if (labels.some((label) => !label || label.startsWith('-') || label.endsWith('-'))) return false;
  return /^[a-zA-Z]{2,63}$/.test(labels.at(-1) ?? '');
}

export function getEmailDomain(email: string) {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}

export function isDisposableEmailDomain(domain: string) {
  return DISPOSABLE_EMAIL_DOMAINS.has(domain.toLowerCase());
}

export function isRoleEmail(email: string) {
  return ROLE_LOCAL_PARTS.has(email.slice(0, email.lastIndexOf('@')).toLowerCase());
}

export function getDomainTypoSuggestion(domain: string) {
  return DOMAIN_TYPOS[domain.toLowerCase()] ?? null;
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

export function extractEmailsFromText(text: string) {
  return parseCsv(text).flatMap((row) =>
    row.flatMap((field) =>
      String(field)
        .split(/[\s;]+/)
        .map(sanitizeEmail)
        .filter(Boolean),
    ),
  );
}

export function validateEmails(emails: string[]) {
  const seen = new Set<string>();
  const results: EmailResult[] = [];
  let valid = 0;
  let invalid = 0;
  let duplicate = 0;

  emails.forEach((email) => {
    const normalized = email.toLowerCase();
    if (seen.has(normalized)) {
      duplicate += 1;
      results.push({ email, status: 'Duplicate', valid: false });
      return;
    }

    seen.add(normalized);
    const isValid = isValidEmailSyntax(email);
    if (isValid) valid += 1;
    else invalid += 1;
    results.push({ email, status: isValid ? 'Valid' : 'Invalid', valid: isValid });
  });

  const checked = valid + invalid;
  return {
    summary: {
      total: results.length,
      checked,
      valid,
      invalid,
      duplicate,
      validRate: checked ? Math.round((valid / checked) * 100) : 0,
      mxValidated: 0,
    } satisfies ValidationSummary,
    emails: results,
  };
}

export function escapeCsvField(field: unknown) {
  const value = String(field ?? '');
  const protectedValue = /^[=+\-@\t\r\n]/.test(value) ? `\t${value}` : value;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}
