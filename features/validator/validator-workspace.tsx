'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { CheckCircle2, Download, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricTile } from '@/components/ui/metric-tile';
import { useErrorNotification } from '@/components/ui/sonner';
import { Textarea } from '@/components/ui/textarea';
import {
  escapeCsvField,
  extractEmailsFromText,
  getEmailDomain,
  MAX_EMAILS,
  MAX_FILE_SIZE,
  MAX_INPUT_LENGTH,
  type EmailResult,
  type ValidationSummary,
  validateEmails,
} from './core';

const emptySummary: ValidationSummary = {
  total: 0,
  checked: 0,
  valid: 0,
  invalid: 0,
  duplicate: 0,
  validRate: 0,
  mxValidated: 0,
};

const sampleEmails = [
  'alex@example.com',
  'jordan@example.co.uk',
  'bad@@example.com',
  'missing-domain@',
  'alex@example.com',
  'name.surname+pattens@sub.example.org',
].join('\n');

const MX_CONCURRENCY = 8;
const CSV_MIME_TYPES = new Set(['', 'text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain']);

type MxLookup = { domain: string; hasMx: boolean };

function isCsvUpload(file: File) {
  return file.name.toLowerCase().endsWith('.csv') && CSV_MIME_TYPES.has(file.type);
}

async function lookupMxDomain(domain: string, signal: AbortSignal): Promise<MxLookup> {
  const response = await fetch('/api/mx', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ domain }),
    signal,
  });
  if (!response.ok) throw new Error('MX lookup failed.');
  return (await response.json()) as MxLookup;
}

async function lookupMxDomains(domains: string[], signal: AbortSignal) {
  const outcomes: PromiseSettledResult<MxLookup>[] = new Array(domains.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < domains.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      try {
        outcomes[currentIndex] = { status: 'fulfilled', value: await lookupMxDomain(domains[currentIndex], signal) };
      } catch (reason) {
        outcomes[currentIndex] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(MX_CONCURRENCY, domains.length) }, worker));
  return outcomes;
}

export function ValidatorWorkspace() {
  const fileInput = useRef<HTMLInputElement>(null);
  const validationRequest = useRef(0);
  const mxAbort = useRef<AbortController | null>(null);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<EmailResult[]>([]);
  const [summary, setSummary] = useState<ValidationSummary>(emptySummary);
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
    setSummary(next.summary);
    const domains = [...new Set(next.emails.filter(({ status: resultStatus }) => resultStatus === 'Valid').map(({ email }) => getEmailDomain(email)))];
    if (!domains.length) return;

    setStatus('Checking MX records...');
    const controller = new AbortController();
    mxAbort.current = controller;
    try {
      const lookupResults = await lookupMxDomains(domains, controller.signal);
      if (controller.signal.aborted || validationRequest.current !== requestId) return;
      const lookups = lookupResults
        .filter((lookup): lookup is PromiseFulfilledResult<{ domain: string; hasMx: boolean }> => lookup.status === 'fulfilled')
        .map(({ value: lookup }) => lookup);
      if (!lookups.length) throw new Error('MX lookup failed.');
      const mxDomains = new Set(lookups.filter(({ hasMx }) => hasMx).map(({ domain }) => domain));
      setSummary({
        ...next.summary,
        mxValidated: next.emails.filter(({ email, status: resultStatus }) => resultStatus === 'Valid' && mxDomains.has(getEmailDomain(email))).length,
      });
    } catch {
      if (!controller.signal.aborted && validationRequest.current === requestId) setError('MX records could not be checked. Syntax and duplicate results are still available.');
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
    setSummary(emptySummary);
    setError('');
    setStatus('');
  };

  const download = () => {
    if (!results.length) {
      setError('No validation results found.');
      return;
    }
    const csv = ['Email,Status', ...results.map(({ email, status: resultStatus }) => `${escapeCsvField(email)},${escapeCsvField(resultStatus)}`)].join('\n');
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.href = url;
    link.download = `email-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const metrics = [
    { label: 'Syntax validated', value: String(summary.valid), className: 'border-emerald-500/20 bg-emerald-500/10' },
    { label: 'Domain validated', value: String(summary.mxValidated), className: 'border-emerald-500/20 bg-emerald-500/10' },
    { label: 'Duplicates', value: String(summary.duplicate), className: 'border-amber-500/20 bg-amber-500/10' },
    { label: 'Invalid', value: String(summary.invalid), className: 'border-red-500/20 bg-red-500/10' },
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
            <Button type="button" variant="secondary" size="sm" className="h-10 px-3" onClick={clear}><RotateCcw className="h-4 w-4" />Reset</Button>
            <input ref={fileInput} className="hidden" type="file" accept=".csv,text/csv" onChange={upload} />
            <p className="w-full text-xs text-muted-foreground">MX checks send valid domains only; email addresses stay in your browser.</p>
            {status && <p className="w-full text-xs text-muted-foreground" role="status">{status}</p>}
          </CardContent>
        </Card>

        <Card className="min-h-[320px] lg:h-full">
          <CardHeader className="border-b"><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="pt-4">
            <dl className="grid grid-cols-2 gap-3">
              {metrics.map((metric) => <MetricTile key={metric.label} {...metric} />)}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
