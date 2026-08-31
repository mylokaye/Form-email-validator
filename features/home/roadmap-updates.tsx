'use client';

import { ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RoadmapResponse } from '@/features/home/roadmap-data';

const emptyData: RoadmapResponse = { items: [], sourceName: 'Microsoft 365 Roadmap', sourceUrl: '', refreshedAt: 0 };
const statusOptions = ['In development', 'Rolling out', 'Launched'];

function displayDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(timestamp));
}

export function RoadmapUpdates({ initialData }: { initialData: RoadmapResponse | null }) {
  const [data, setData] = useState<RoadmapResponse>(initialData ?? emptyData);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');

  const load = async () => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/m365-roadmap');
      const payload = await response.json() as RoadmapResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'The roadmap could not be loaded.');
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'The roadmap could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialData) return;
    void load();
  }, [initialData]);

  const visibleItems = useMemo(() => data.items.filter((item) => !status || item.status === status).slice(0, 3), [data.items, status]);

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <CardTitle>Microsoft 365 roadmap</CardTitle>
            <CardDescription className="mt-1">The three most recently updated roadmap items.</CardDescription>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="sr-only" htmlFor="roadmap-status">Filter roadmap updates</label>
          <select id="roadmap-status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 min-w-36 rounded-[10px] border border-input bg-background px-3 text-[13px] leading-4 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <option value="">All statuses</option>
            {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw data-icon="inline-start" className={loading ? 'animate-spin' : undefined} />Refresh</Button>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{error}</div>}
        {loading && <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">Refreshing the Microsoft 365 roadmap…</div>}
        {!loading && !error && visibleItems.length === 0 && <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">No roadmap updates match this filter.</div>}
        {!loading && !error && visibleItems.length > 0 && <div className="grid gap-4 md:grid-cols-3">
          {visibleItems.map((item) => <Card key={item.id} size="sm" className="h-full bg-background/45 transition-colors hover:bg-muted/40"><CardContent className="flex h-full flex-col gap-4 p-4"><div className="flex items-center justify-between gap-3"><Badge>{item.status || 'Roadmap update'}</Badge><span className="text-right text-xs text-muted-foreground">{displayDate(item.updatedAt)}</span></div><a href={item.url} target="_blank" rel="noreferrer" className="group flex flex-1 flex-col gap-2"><h2 className="text-base font-semibold leading-6 group-hover:text-primary">{item.title}<ExternalLink className="ml-1.5 inline size-3.5" /></h2><p className="line-clamp-4 text-sm leading-6 text-muted-foreground">{item.summary}</p></a></CardContent></Card>)}
        </div>}
      </CardContent>
    </Card>
  );
}
