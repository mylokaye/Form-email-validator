'use client';

import { useState } from 'react';
import { Play, RotateCcw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricTile } from '@/components/ui/metric-tile';
import { useErrorNotification } from '@/components/ui/sonner';
import { Textarea } from '@/components/ui/textarea';

type Audience = 'Customers' | 'Stakeholders' | 'Public';
type Sentiment = 'Positive' | 'Mixed' | 'Critical';
type Persona = { name: string; role: string; stance: Sentiment; influence: number };
type Event = { round: number; author: string; text: string; sentiment: Sentiment };
type Result = { sentiment: number; overallResponse: string; keyConcerns: string[]; recommendedNextStep: string };

const personas: Record<Audience, Persona[]> = {
  Customers: [{ name: 'Maya Patel', role: 'Finance', stance: 'Positive', influence: 86 }, { name: 'Alex Morgan', role: 'Executive', stance: 'Critical', influence: 91 }, { name: 'Chris Okafor', role: 'Operations', stance: 'Mixed', influence: 74 }],
  Stakeholders: [{ name: 'Taylor Reed', role: 'Partner', stance: 'Positive', influence: 84 }, { name: 'Samira Khan', role: 'Supplier', stance: 'Critical', influence: 78 }, { name: 'Jordan Wells', role: 'Agent', stance: 'Mixed', influence: 70 }],
  Public: [{ name: 'Casey Brooks', role: 'Customer', stance: 'Positive', influence: 72 }, { name: 'Morgan Lee', role: 'Stakeholder', stance: 'Critical', influence: 80 }, { name: 'Jamie Park', role: 'General public', stance: 'Mixed', influence: 65 }],
};

const tone = { Positive: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', Mixed: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', Critical: 'bg-red-500/15 text-red-700 dark:text-red-300' };
const durationOptions = [
  { rounds: 1, label: '1 hour' },
  { rounds: 6, label: '6 hours' },
  { rounds: 24, label: '24 hours' },
];

export function SimulationWorkspace() {
  const [proposal, setProposal] = useState('');
  const [audience, setAudience] = useState<Audience>('Customers');
  const [rounds, setRounds] = useState(6);
  const [events, setEvents] = useState<Event[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  useErrorNotification(error, 'simulation-error');
  const selectedPersonas = personas[audience];

  const reset = () => { setEvents([]); setResult(null); setError(''); };
  const run = async () => {
    if (!proposal.trim()) { setError('Add a proposal before running the simulation.'); return; }
    setRunning(true); reset();
    try {
      const response = await fetch('/api/simulate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proposal, audience, rounds, personas: selectedPersonas }) });
      const payload = await response.json() as { timeline?: Event[]; result?: Result; error?: string };
      if (!response.ok || !payload.timeline || !payload.result) throw new Error(payload.error || 'The simulation could not be generated.');
      for (const event of payload.timeline) {
        await new Promise((resolve) => window.setTimeout(resolve, 260));
        setEvents((current) => [...current, event]);
      }
      setResult(payload.result);
    } catch (runError) { setError(runError instanceof Error ? runError.message : 'The simulation could not be generated.'); }
    finally { setRunning(false); }
  };

  return <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)] xl:items-start">
    <Card>
      <CardHeader className="border-b"><CardTitle>Proposal</CardTitle></CardHeader>
      <CardContent className="grid gap-5 pt-5">
        <Textarea value={proposal} onChange={(event) => { setProposal(event.target.value); setError(''); }} placeholder="Describe the proposal you want to test with an audience." className="min-h-36 resize-y" maxLength={3000} />
        <div className="grid gap-4">
          <fieldset className="grid gap-2" disabled={running}>
            <legend className="text-sm font-medium">Duration</legend>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Duration">
              {durationOptions.map((option) => <Button key={option.rounds} type="button" variant={rounds === option.rounds ? 'secondary' : 'outline'} className="min-w-0 px-2" aria-pressed={rounds === option.rounds} onClick={() => { setRounds(option.rounds); reset(); }}>{option.label}</Button>)}
            </div>
          </fieldset>
          <fieldset className="grid gap-2" disabled={running}>
            <legend className="text-sm font-medium">Audience</legend>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Audience">
              {Object.keys(personas).map((item) => <Button key={item} type="button" variant={audience === item ? 'secondary' : 'outline'} className="min-w-0 px-2 text-xs" aria-pressed={audience === item} onClick={() => { setAudience(item as Audience); reset(); }}>{item}</Button>)}
            </div>
          </fieldset>
        </div>
        <div className="flex gap-3"><Button type="button" onClick={() => void run()} disabled={running} className="flex-1"><Play className="h-4 w-4" />{running ? `Running ${events.length}/${rounds}` : 'Run'}</Button><Button type="button" variant="secondary" onClick={reset} disabled={running}><RotateCcw className="h-4 w-4" />Reset</Button></div>
      </CardContent>
    </Card>
    <Card className="min-h-[560px]">
      <CardHeader className="flex flex-row items-center justify-between border-b"><CardTitle>Audience</CardTitle><span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{events.length} / {rounds} rounds</span></CardHeader>
      <CardContent className="grid gap-5 pt-5"><div className="grid gap-2"><div className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4" />Personas</div><div className="grid gap-2 md:grid-cols-3">{selectedPersonas.map((persona) => <div key={persona.name} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-3"><div><p className="text-sm font-medium">{persona.name}</p><p className="text-xs text-muted-foreground">{persona.role}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone[persona.stance]}`}>{persona.stance}</span></div>)}</div></div>
        <div className="grid gap-2"><p className="text-sm font-medium">Status</p><div className="grid grid-cols-3 gap-3"><MetricTile label="Progress" value={`${rounds ? Math.round((events.length / rounds) * 100) : 0}%`} /><MetricTile label="Personas" value={String(selectedPersonas.length)} /><MetricTile label="Response" value={result ? `${result.sentiment}%` : '—'} /></div></div>
        <div className="min-h-56 space-y-3">{events.length ? events.map((event) => <article className="rounded-lg border border-border p-4" key={`${event.round}-${event.author}`}><div className="mb-2 flex items-center justify-between gap-3"><div><span className="mr-2 text-xs font-medium text-muted-foreground">ROUND {event.round}</span><span className="text-sm font-semibold">{event.author}</span></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone[event.sentiment]}`}>{event.sentiment}</span></div><p className="text-sm leading-6 text-muted-foreground">{event.text}</p></article>) : <div className="flex min-h-56 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">No audience response yet.</div>}</div>
        {result && <div className="grid gap-3 border-t pt-5"><p className="text-sm font-semibold">Response</p><ResultBlock label="Overall response" value={result.overallResponse} /><ResultBlock label="Key concerns" value={result.keyConcerns.join(' · ')} /><ResultBlock label="Recommended next step" value={result.recommendedNextStep} /></div>}
      </CardContent>
    </Card>
  </div>;
}

function ResultBlock({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border bg-secondary/30 p-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm leading-6">{value}</p></div>; }
