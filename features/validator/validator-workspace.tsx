'use client';

import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricTile } from '@/components/ui/metric-tile';
import { Textarea } from '@/components/ui/textarea';
import {
  escapeCsvField,
  extractEmailsFromText,
  getEmailDomain,
  MAX_EMAILS,
  MAX_FILE_SIZE,
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

export function ValidatorWorkspace() {
  const fileInput = useRef<HTMLInputElement>(null);
  const validationRequest = useRef(0);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<EmailResult[]>([]);
  const [summary, setSummary] = useState<ValidationSummary>(emptySummary);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const emailCount = useMemo(() => extractEmailsFromText(input).length, [input]);

  const validate = async (value = input) => {
    setError('');
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
    const requestId = validationRequest.current + 1;
    validationRequest.current = requestId;
    const domains = [...new Set(next.emails.filter(({ status: resultStatus }) => resultStatus === 'Valid').map(({ email }) => getEmailDomain(email)))];
    if (!domains.length) return;

    setStatus('Checking MX records...');
    try {
      const lookupResults = await Promise.allSettled(
        domains.map(async (domain) => {
          const response = await fetch(`/api/mx?domain=${encodeURIComponent(domain)}`);
          if (!response.ok) throw new Error('MX lookup failed.');
          const result = (await response.json()) as { domain: string; hasMx: boolean };
          return result;
        }),
      );
      if (validationRequest.current !== requestId) return;
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
      if (validationRequest.current === requestId) setError('MX records could not be checked. Syntax and duplicate results are still available.');
    } finally {
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
      if (file.size > MAX_FILE_SIZE) throw new Error('File too large. Maximum size is 5MB.');
      const text = await file.text();
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
    ['Valid', String(summary.valid)],
    ['Health', `${summary.validRate}%`],
    ['Duplicates', String(summary.duplicate)],
    ['Invalid', String(summary.invalid)],
    ['MX Validated', String(summary.mxValidated)],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Card className="min-h-[520px]">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
          <CardTitle>Emails</CardTitle>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">{emailCount} found</span>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-3" onClick={loadSample}>Sample</Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 pt-4">
          <Textarea
            aria-label="Emails"
            className="min-h-[400px] flex-1 resize-none p-4 font-mono text-sm leading-6"
            onChange={(event) => { setError(''); setInput(event.target.value); }}
            spellCheck={false}
            value={input}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader className="border-b"><CardTitle>Actions</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pt-4">
            <Button type="button" onClick={() => void validate()}><CheckCircle2 className="h-4 w-4" />Validate</Button>
            <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" />Upload</Button>
            <Button type="button" variant="secondary" disabled={!results.length} onClick={download}><Download className="h-4 w-4" />CSV</Button>
            <Button type="button" variant="secondary" onClick={clear}><RotateCcw className="h-4 w-4" />Clear</Button>
            <input ref={fileInput} className="hidden" type="file" accept=".csv,text/csv" onChange={upload} />
            {status && <p className="col-span-2 text-xs text-muted-foreground" role="status">{status}</p>}
          </CardContent>
        </Card>

        <Card className="min-h-[320px]">
          <CardHeader className="border-b"><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="pt-4">
            <dl className="grid grid-cols-2 gap-3">
              {metrics.map(([label, value]) => <MetricTile key={label} label={label} value={value} />)}
            </dl>
            {error && <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
