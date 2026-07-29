'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, CircleX, Download, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricTile } from '@/components/ui/metric-tile';
import { useErrorNotification } from '@/components/ui/sonner';
import { Textarea } from '@/components/ui/textarea';
import {
  escapeCsvField,
  extractEmailsFromText,
  getDomainTypoSuggestion,
  getEmailDomain,
  isDisposableEmailDomain,
  isRoleEmail,
  MAX_EMAILS,
  MAX_FILE_SIZE,
  MAX_INPUT_LENGTH,
  type EmailResult,
  validateEmails,
} from './core';

const sampleEmails = [
  'alex@example.com',
  'jordan@example.co.uk',
  'bad@@example.com',
  'missing-domain@',
  'alex@example.com',
  'name.surname+pattens@sub.example.org',
].join('\n');

const DOMAIN_LOOKUP_CONCURRENCY = 2;
const CSV_MIME_TYPES = new Set(['', 'text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain']);

type DomainLookup = {
  domain: string;
  hasDmarc: boolean | null;
  hasNullMx: boolean;
  hasSpf: boolean | null;
  mailRoute: 'implicit' | 'mx' | 'none' | 'unknown';
};

type Confidence = 'green' | 'orange' | 'red';

type Verification = {
  className: string;
  confidence: Confidence;
  description: string;
  icon: typeof CheckCircle2;
  reason: string;
  status: string;
};

function isCsvUpload(file: File) {
  return file.name.toLowerCase().endsWith('.csv') && CSV_MIME_TYPES.has(file.type);
}

async function lookupDomain(domain: string, signal: AbortSignal): Promise<DomainLookup> {
  const response = await fetch('/api/mx', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ domain }),
    signal,
  });
  if (!response.ok) throw new Error('Domain lookup failed.');
  return (await response.json()) as DomainLookup;
}

async function lookupDomains(domains: string[], signal: AbortSignal) {
  const outcomes: PromiseSettledResult<DomainLookup>[] = new Array(domains.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < domains.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      try {
        outcomes[currentIndex] = { status: 'fulfilled', value: await lookupDomain(domains[currentIndex], signal) };
      } catch (reason) {
        outcomes[currentIndex] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(DOMAIN_LOOKUP_CONCURRENCY, domains.length) }, worker));
  return outcomes;
}

function verificationResult({ email, status: resultStatus }: EmailResult, domainChecks: Record<string, DomainLookup>): Verification {
  if (resultStatus === 'Invalid') return { className: 'border-red-500/20 bg-red-500/5', confidence: 'red', description: 'The address format is invalid.', icon: CircleX, reason: 'Invalid email format', status: 'Not usable' };
  if (resultStatus === 'Duplicate') return { className: 'border-amber-500/20 bg-amber-500/5', confidence: 'orange', description: 'This address appears more than once in the submitted list.', icon: CircleAlert, reason: 'Duplicate address', status: 'Needs review' };

  const domain = getEmailDomain(email);
  const domainCheck = domainChecks[domain];
  if (!domainCheck || domainCheck.mailRoute === 'unknown') return { className: 'border-amber-500/20 bg-amber-500/5', confidence: 'orange', description: 'The domain mail route could not be confirmed. Try again.', icon: CircleAlert, reason: 'Domain check unavailable', status: 'Needs review' };
  if (domainCheck.hasNullMx) return { className: 'border-red-500/20 bg-red-500/5', confidence: 'red', description: 'This domain explicitly rejects all email. The mailbox is unverified.', icon: CircleX, reason: 'Domain rejects all email (null MX)', status: 'Not usable' };
  if (isDisposableEmailDomain(domain)) return { className: 'border-red-500/20 bg-red-500/5', confidence: 'red', description: 'This is a known disposable-email domain.', icon: CircleX, reason: 'Disposable email domain', status: 'Not usable' };
  const typoSuggestion = getDomainTypoSuggestion(domain);
  if (typoSuggestion) return { className: 'border-amber-500/20 bg-amber-500/5', confidence: 'orange', description: `This domain may be a typo. Did you mean ${typoSuggestion}?`, icon: CircleAlert, reason: 'Likely domain typo', status: 'Needs review' };
  if (domainCheck.mailRoute === 'none') return { className: 'border-red-500/20 bg-red-500/5', confidence: 'red', description: 'This domain has no mail route. The mailbox is unverified.', icon: CircleX, reason: 'No mail route found', status: 'Not usable' };
  if (isRoleEmail(email)) return { className: 'border-amber-500/20 bg-amber-500/5', confidence: 'orange', description: 'This is a role address. It may work, but it is not a personal inbox.', icon: CircleAlert, reason: 'Role address', status: 'Needs review' };
  return { className: 'border-emerald-500/20 bg-emerald-500/5', confidence: 'green', description: 'A mail route was found. The specific mailbox is unverified.', icon: CheckCircle2, reason: 'Mailbox unverified', status: 'Likely usable' };
}

function signalLabel(label: string, value: boolean | null) {
  if (value === null) return `${label} unavailable`;
  return value ? `${label} published` : `${label} not published`;
}

export function ValidatorWorkspace() {
  const fileInput = useRef<HTMLInputElement>(null);
  const validationRequest = useRef(0);
  const mxAbort = useRef<AbortController | null>(null);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<EmailResult[]>([]);
  const [domainChecks, setDomainChecks] = useState<Record<string, DomainLookup>>({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  useErrorNotification(error, 'validator-error');
  const validate = async (value = input) => {
    mxAbort.current?.abort();
    mxAbort.current = null;
    const requestId = validationRequest.current + 1;
    validationRequest.current = requestId;
    setError('');
    if (value.length > MAX_INPUT_LENGTH) {
      setError('Input is too large. Maximum size is 1MB.');
      return;
    }
    const emails = extractEmailsFromText(value);
    if (!emails.length) {
      setError('Paste or upload at least one email address.');
      return;
    }
    if (emails.length > MAX_EMAILS) {
      setError('Input exceeds the 300 email limit.');
      return;
    }

    const next = validateEmails(emails);
    setResults(next.emails);
    setDomainChecks({});
    const domains = [...new Set(next.emails.filter(({ status: resultStatus }) => resultStatus === 'Valid').map(({ email }) => getEmailDomain(email)))];
    if (!domains.length) return;

    setStatus('Checking mail-domain signals...');
    const controller = new AbortController();
    mxAbort.current = controller;
    try {
      const lookupResults = await lookupDomains(domains, controller.signal);
      if (controller.signal.aborted || validationRequest.current !== requestId) return;
      const lookups = lookupResults
        .filter((lookup): lookup is PromiseFulfilledResult<DomainLookup> => lookup.status === 'fulfilled')
        .map(({ value: lookup }) => lookup);
      if (!lookups.length) throw new Error('Domain lookup failed.');
      setDomainChecks(Object.fromEntries(lookups.map((lookup) => [lookup.domain, lookup])));
    } catch {
      if (!controller.signal.aborted && validationRequest.current === requestId) setError('Mail-domain checks could not be completed. Syntax and duplicate results are still available.');
    } finally {
      if (mxAbort.current === controller) mxAbort.current = null;
      if (validationRequest.current === requestId) setStatus('');
    }
  };

  const loadSample = () => {
    setError('');
    setInput(sampleEmails);
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setStatus(`Loading ${file.name}...`);
    try {
      if (!isCsvUpload(file)) throw new Error('Upload a CSV file.');
      if (file.size > MAX_FILE_SIZE) throw new Error('File too large. Maximum size is 1MB.');
      const text = await file.text();
      if (text.includes('\0')) throw new Error('The CSV contains unsupported binary data.');
      setInput(text);
      await validate(text);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to read the selected file.');
    } finally {
      setStatus('');
      event.target.value = '';
    }
  };

  const clear = () => {
    mxAbort.current?.abort();
    mxAbort.current = null;
    validationRequest.current += 1;
    setInput('');
    setResults([]);
    setDomainChecks({});
    setError('');
    setStatus('');
  };

  const download = () => {
    if (!results.length) {
      setError('No validation results found.');
      return;
    }
    const csv = ['Email,Confidence,Reason,Mail route,SPF,DMARC,Mailbox status', ...results.map((result) => {
      const verification = verificationResult(result, domainChecks);
      const check = domainChecks[getEmailDomain(result.email)];
      const route = check?.mailRoute === 'mx' ? 'MX record found' : check?.mailRoute === 'implicit' ? 'Mail server found' : check?.mailRoute === 'none' ? 'No mail route' : 'Unavailable';
      return [result.email, verification.status, verification.reason, route, signalLabel('SPF', check?.hasSpf ?? null).replace('SPF ', ''), signalLabel('DMARC', check?.hasDmarc ?? null).replace('DMARC ', ''), 'Unverified'].map(escapeCsvField).join(',');
    })].join('\n');
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.href = url;
    link.download = `email-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const confidences = results.map((result) => verificationResult(result, domainChecks));
  const metrics = [
    { label: 'Likely usable', value: String(confidences.filter(({ confidence }) => confidence === 'green').length), className: 'border-emerald-500/20 bg-emerald-500/10' },
    { label: 'Needs review', value: String(confidences.filter(({ confidence }) => confidence === 'orange').length), className: 'border-amber-500/20 bg-amber-500/10' },
    { label: 'Not usable', value: String(confidences.filter(({ confidence }) => confidence === 'red').length), className: 'border-red-500/20 bg-red-500/10' },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
      <Card className="min-h-[520px] lg:h-full">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
          <CardTitle>Emails</CardTitle>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-8 px-3" onClick={loadSample}>Sample</Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 pt-4">
          <Textarea
            aria-label="Emails"
            className="min-h-[400px] flex-1 resize-none p-4 font-mono text-sm leading-6"
            maxLength={MAX_INPUT_LENGTH}
            onChange={(event) => { setError(''); setInput(event.target.value); }}
            spellCheck={false}
            value={input}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:h-full lg:grid-rows-[auto_1fr]">
        <Card>
          <CardHeader className="border-b"><CardTitle>Actions</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 pt-4">
            <Button type="button" className="min-w-32 flex-1" onClick={() => void validate()}><CheckCircle2 className="h-4 w-4" />Validate</Button>
            <Button type="button" variant="secondary" className="min-w-28" onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" />Upload</Button>
            <Button type="button" variant="secondary" className="min-w-20" disabled={!results.length} onClick={download}><Download className="h-4 w-4" />CSV</Button>
            <Button type="button" variant="secondary" size="sm" className="px-3" onClick={clear}><RotateCcw className="h-4 w-4" />Reset</Button>
            <input ref={fileInput} className="hidden" type="file" accept=".csv,text/csv" onChange={upload} />
            <p className="w-full text-xs text-muted-foreground">Mail-domain checks send valid domains only; email addresses stay in your browser.</p>
            {status && <p className="w-full text-xs text-muted-foreground" role="status">{status}</p>}
          </CardContent>
        </Card>

        <Card className="min-h-[320px] lg:h-full">
          <CardHeader className="border-b"><CardTitle>Verification summary</CardTitle></CardHeader>
          <CardContent className="pt-4">
            <dl className="grid grid-cols-2 gap-3">
              {metrics.map((metric) => <MetricTile key={metric.label} {...metric} />)}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">Green means a likely usable address, not a confirmed mailbox. Pattens does not perform mailbox-level SMTP checks.</p>
          </CardContent>
        </Card>
      </div>

      {results.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader className="border-b"><CardTitle>Verification results</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-4">
            {results.map((result, index) => {
              const verification = verificationResult(result, domainChecks);
              const Icon = verification.icon;
              const domainCheck = domainChecks[getEmailDomain(result.email)];
              return (
                <article key={`${result.email}-${index}`} className={`rounded-lg border p-4 ${verification.className}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{result.email}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{verification.description}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-sm font-medium">{verification.status}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{verification.reason}</p>
                    </div>
                  </div>
                  {result.status === 'Valid' && domainCheck && (
                    <details className="mt-3 border-t border-current/10 pt-3 text-xs text-muted-foreground">
                      <summary className="cursor-pointer font-medium text-foreground">Domain signals</summary>
                      <p className="mt-2">{domainCheck.mailRoute === 'mx' ? 'MX record found' : domainCheck.mailRoute === 'implicit' ? 'Mail server found' : domainCheck.mailRoute === 'none' ? 'No mail route found' : 'Mail route unavailable'} · {signalLabel('SPF', domainCheck.hasSpf)} · {signalLabel('DMARC', domainCheck.hasDmarc)} · Mailbox unverified</p>
                    </details>
                  )}
                </article>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
