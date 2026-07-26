'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, FileCode2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricTile } from '@/components/ui/metric-tile';
import { useErrorNotification } from '@/components/ui/sonner';
import { Textarea } from '@/components/ui/textarea';
import {
  buildFetchXml,
  hasExpectedCountryHeaders,
  hasExpectedStateHeaders,
  isValidCountryMaster,
  isValidStateMaster,
  parseCountryCsv,
  parseStateCsv,
  type Country,
  type CountryItem,
  validateCountries,
  validateStates,
} from './core';

export function LogicWorkspace() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<Country[]>([]);
  const [mode, setMode] = useState<'country' | 'state'>('country');
  const [input, setInput] = useState('');
  const [items, setItems] = useState<CountryItem[]>([]);
  const [xml, setXml] = useState('');
  const [error, setError] = useState('');
  const [countryMasterError, setCountryMasterError] = useState('');
  const [stateMasterError, setStateMasterError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/countries.csv')
      .then((response) => {
        if (!response.ok) throw new Error('Country list could not be loaded. Refresh the page and try again.');
        return response.text();
      })
      .then((text) => {
        const master = parseCountryCsv(text);
        if (!hasExpectedCountryHeaders(text) || !isValidCountryMaster(master)) {
          throw new Error('Country list is unavailable or has an invalid format.');
        }
        if (active) setCountries(master);
      })
      .catch((loadError) => {
        if (active) setCountryMasterError(loadError instanceof Error ? loadError.message : 'Country list could not be loaded.');
      });
    fetch('/states.csv')
      .then((response) => {
        if (!response.ok) throw new Error('State list could not be loaded. Refresh the page and try again.');
        return response.text();
      })
      .then((text) => {
        const master = parseStateCsv(text);
        if (!hasExpectedStateHeaders(text) || !isValidStateMaster(master)) {
          throw new Error('State list is unavailable or has an invalid format.');
        }
        if (active) setStates(master);
      })
      .catch((loadError) => {
        if (active) setStateMasterError(loadError instanceof Error ? loadError.message : 'State list could not be loaded.');
      });
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => ({
    valid: items.filter(({ status }) => status === 'valid').length,
    invalid: items.filter(({ status }) => status === 'invalid').length,
    duplicate: items.filter(({ status }) => status === 'duplicate').length,
    ambiguous: items.filter(({ status }) => status === 'ambiguous').length,
  }), [items]);
  const master = mode === 'country' ? countries : states;
  const masterError = mode === 'country' ? countryMasterError : stateMasterError;
  useErrorNotification(error || masterError, 'logic-error');
  const isReady = items.length > 0 && counts.invalid === 0 && counts.duplicate === 0 && counts.ambiguous === 0;
  const warnings = items.filter(({ status }) => status !== 'valid');

  const resetResults = () => {
    setItems([]);
    setXml('');
    setCopied(false);
  };

  const validate = () => {
    setError('');
    if (!master.length) return;
    const next = mode === 'country' ? validateCountries(input, countries) : validateStates(input, states);
    if (!next.length) {
      setError(`Add at least one ${mode === 'country' ? 'country' : 'state'}.`);
      resetResults();
      return;
    }
    setItems(next);
    setXml('');
    setCopied(false);
  };

  const generate = () => {
    if (!isReady) return;
    setXml(buildFetchXml(items, mode));
    setCopied(false);
  };

  const copy = async () => {
    if (!xml) return;
    try {
      await navigator.clipboard.writeText(xml);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Copy is unavailable. Select the XML and copy it manually.');
    }
  };

  const clear = () => {
    setInput('');
    setError('');
    resetResults();
  };

  const summary = [
    ['Valid', String(counts.valid)],
    ['Invalid', String(counts.invalid)],
    ['Duplicates', String(counts.duplicate)],
    ['Ambiguous', String(counts.ambiguous)],
    ['Status', isReady ? 'Ready' : items.length ? 'Error' : 'Awaiting'],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Card className="min-h-[520px]">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
          <CardTitle>{mode === 'country' ? 'Countries' : 'States'}</CardTitle>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Logic type">
            {(['country', 'state'] as const).map((item) => <Button key={item} type="button" size="sm" className="h-8 px-3" variant={mode === item ? 'default' : 'secondary'} role="tab" aria-selected={mode === item} onClick={() => { setMode(item); setInput(''); setError(''); resetResults(); }}>{item === 'country' ? 'Country' : 'State'}</Button>)}
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4 pt-4">
          <Textarea
            aria-label={mode === 'country' ? 'Countries' : 'States'}
            className="min-h-[355px] flex-1 resize-none p-4 font-mono text-sm leading-6"
            onChange={(event) => { setError(''); setInput(event.target.value); resetResults(); }}
            spellCheck={false}
            value={input}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant={isReady ? 'secondary' : 'default'} disabled={!master.length || Boolean(masterError)} onClick={validate}><CheckCircle2 className="h-4 w-4" />Validate</Button>
            <Button type="button" variant={isReady && !xml ? 'default' : 'secondary'} disabled={!isReady} onClick={generate}><FileCode2 className="h-4 w-4" />Generate</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-[520px]">
        <CardHeader className="flex flex-row items-center border-b"><CardTitle>XML</CardTitle></CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4 pt-4">
          <Textarea aria-label="Generated FetchXML" className="min-h-[355px] flex-1 resize-none p-4 font-mono text-xs leading-5" readOnly value={xml} />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant={xml ? 'default' : 'secondary'} disabled={!xml} onClick={() => void copy()}>{copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy'}</Button>
            <Button type="button" variant="secondary" onClick={clear}><RotateCcw className="h-4 w-4" />Reset</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="border-b"><CardTitle>Summary</CardTitle></CardHeader>
        <CardContent className="pt-4">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {summary.map(([label, value]) => (
              <MetricTile key={label} label={label} value={value} />
            ))}
          </dl>
          {warnings.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Warnings</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {warnings.map((item, index) => <li key={`${item.input}-${index}`} className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">{item.input} <span className="text-foreground">({item.status})</span></li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
