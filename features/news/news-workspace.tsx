'use client';

import Link from 'next/link';
import { ExternalLink, RefreshCw, Rss, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Source = { id: number; name: string; homepageUrl: string };
type NewsItem = { id: number; sourceId: number; sourceName: string; sourceUrl: string; title: string; summary: string; url: string; publishedAt: number };
type NewsResponse = { items: NewsItem[]; sources: Source[]; refreshedAt: number };
type MonitorItem = { id: string; title: string; area: string; sourceUrl: string; previewDate: string; gaDate: string; previewStatus: string; gaStatus: string; lastUpdatedAt: number | null; change: { summary: string; detectedAt: number } | null };
type MonitorResponse = { sourceUrl: string; columns: { generalAvailability: MonitorItem[]; publicPreview: MonitorItem[]; planned: MonitorItem[] }; changes: { featureId: string; summary: string; detectedAt: number }[]; checkedAt: number | null; lastError: string | null };

function displayDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}

export function NewsWorkspace() {
  const [data, setData] = useState<NewsResponse>({ items: [], sources: [], refreshedAt: 0 });
  const [selectedSource, setSelectedSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monitor, setMonitor] = useState<MonitorResponse | null>(null);
  const [monitorLoading, setMonitorLoading] = useState(true);
  const [monitorError, setMonitorError] = useState('');

  const load = async (source = selectedSource) => {
    setLoading(true); setError('');
    try {
      const query = source ? `?source=${encodeURIComponent(source)}` : '';
      const response = await fetch(`/api/news${query}`);
      const payload = await response.json() as NewsResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'News could not be loaded.');
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'News could not be loaded.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(''); }, []);
  const loadMonitor = async () => {
    setMonitorLoading(true); setMonitorError('');
    try {
      const response = await fetch('/api/release-monitor');
      const payload = await response.json() as MonitorResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Release monitor could not be loaded.');
      setMonitor(payload);
      if (payload.lastError) setMonitorError(payload.lastError);
    } catch (loadError) { setMonitorError(loadError instanceof Error ? loadError.message : 'Release monitor could not be loaded.'); }
    finally { setMonitorLoading(false); }
  };
  useEffect(() => { void loadMonitor(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground"><Sparkles className="h-4 w-4" />Release monitor</div>
          <h1 className="text-2xl font-semibold tracking-tight">Customer Insights – Journeys</h1>
          <p className="mt-1 text-sm text-muted-foreground">Microsoft release-plan features from 2026 onwards, grouped by delivery state.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="news-source">Filter by source</label>
          <select id="news-source" value={selectedSource} onChange={(event) => { setSelectedSource(event.target.value); void load(event.target.value); }} className="h-[50px] min-w-44 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <option value="">All sources</option>
            {data.sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
          </select>
          <Button type="button" variant="secondary" onClick={() => { void load(); void loadMonitor(); }} disabled={loading || monitorLoading}><RefreshCw className={loading || monitorLoading ? 'animate-spin' : ''} />Refresh</Button>
        </div>
      </div>

      {error && <Card className="border-destructive/30 bg-destructive/5"><CardContent className="py-1 text-sm text-destructive" role="alert">{error}</CardContent></Card>}

      {monitorError && <Card className="border-destructive/30 bg-destructive/5"><CardContent className="py-1 text-sm text-destructive" role="alert">{monitorError}</CardContent></Card>}

      <Card>
        <CardHeader className="border-b"><CardTitle>Release plan</CardTitle><span className="text-xs text-muted-foreground">{monitor?.checkedAt ? `Checked ${displayDate(monitor.checkedAt)}` : 'Checking Microsoft Release Plans…'}</span></CardHeader>
        <CardContent className="p-4">
          {monitorLoading ? <div className="py-10 text-center text-sm text-muted-foreground">Checking the latest release-plan changes…</div> : <div className="grid gap-4 xl:grid-cols-3">
            {([['generalAvailability', 'General availability'], ['publicPreview', 'Public preview'], ['planned', 'Planned']] as const).map(([key, title]) => <section key={key} className="overflow-hidden rounded-lg border bg-muted/20"><div className="flex h-10 items-center justify-between border-b bg-background px-3"><h2 className="text-sm font-semibold">{title}</h2><span className="text-xs text-muted-foreground">{monitor?.columns[key].length || 0}</span></div><div className="space-y-3 p-3">{monitor?.columns[key].length ? monitor.columns[key].map((item) => <article key={item.id} className="rounded-md border bg-background p-3"><div className="flex items-start justify-between gap-3"><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold leading-5 hover:text-primary hover:underline">{item.title}<ExternalLink className="ml-1 inline h-3 w-3" /></a>{item.change && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Updated</span>}</div>{item.area && <p className="mt-1 text-xs text-muted-foreground">{item.area}</p>}<div className="mt-3 space-y-1 text-xs text-muted-foreground">{item.previewDate && <p>Preview: {item.previewDate}{item.previewStatus ? ` · ${item.previewStatus}` : ''}</p>}{item.gaDate && <p>GA: {item.gaDate}{item.gaStatus ? ` · ${item.gaStatus}` : ''}</p>}{item.lastUpdatedAt && <p>Last updated: {displayDate(item.lastUpdatedAt)}</p>}{item.change && <p className="pt-1 font-medium text-foreground">{item.change.summary}</p>}</div></article>) : <div className="rounded-md border border-dashed px-3 py-7 text-center text-sm text-muted-foreground">No 2026+ features.</div>}</div></section>)}
          </div>}
        </CardContent>
      </Card>

      {!loading && !error && data.items.length === 0 && (
        <Card><CardContent className="flex min-h-64 flex-col items-center justify-center py-12 text-center"><Rss className="mb-3 h-7 w-7 text-muted-foreground" /><p className="font-medium">The newsroom is getting ready.</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">Stories will appear here once a shared RSS or Atom source is added.</p><Link href="/news/manage/" className="mt-5 text-sm font-medium text-primary hover:underline">Manage sources</Link></CardContent></Card>
      )}

      {loading && <Card><CardContent className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Refreshing the latest stories…</CardContent></Card>}

      {!loading && data.items.length > 0 && (
        <Card>
          <CardHeader className="border-b"><CardTitle>Stories</CardTitle><span className="text-xs text-muted-foreground">{data.items.length} latest</span></CardHeader>
          <CardContent className="divide-y px-4">
            {data.items.map((item) => (
              <article key={item.id} className="py-5 first:pt-4 last:pb-4">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-foreground hover:underline">{item.sourceName}</a><span>{displayDate(item.publishedAt)}</span></div>
                <a href={item.url} target="_blank" rel="noreferrer" className="group block"><h2 className="text-base font-semibold leading-6 group-hover:text-primary">{item.title}<ExternalLink className="ml-1.5 inline h-3.5 w-3.5" /></h2>{item.summary && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{item.summary}</p>}</a>
              </article>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
