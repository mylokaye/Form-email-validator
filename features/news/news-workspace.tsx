'use client';

import { ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NewsResponse } from '@/features/news/news-data';
import { NewsStories } from '@/features/news/news-stories';
import type { MonitorItem, MonitorResponse } from '@/features/news/release-monitor-data';

function displayDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(timestamp));
}

export function NewsWorkspace({ initialNews, initialMonitor }: { initialNews: NewsResponse | null; initialMonitor: MonitorResponse | null }) {
  const [monitor, setMonitor] = useState<MonitorResponse | null>(initialMonitor);
  const [monitorLoading, setMonitorLoading] = useState(!initialMonitor);
  const [monitorError, setMonitorError] = useState('');
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
  useEffect(() => {
    if (initialMonitor) return;
    void loadMonitor();
  }, [initialMonitor]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground"><Sparkles className="h-4 w-4" />Release monitor</div>
          <h1 className="text-2xl font-semibold tracking-tight">Newsroom</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Keep up with the latest stories and Microsoft release-plan features from 2026 onwards.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void loadMonitor()} disabled={monitorLoading}><RefreshCw data-icon="inline-start" className={monitorLoading ? 'animate-spin' : undefined} />Refresh plan</Button>
      </div>

      {monitorError && <Card className="border-destructive/30 bg-destructive/5"><CardContent className="py-1 text-sm text-destructive" role="alert">{monitorError}</CardContent></Card>}

      <Card>
        <CardHeader className="border-b"><CardTitle>Release plan</CardTitle><span className="text-xs text-muted-foreground">{monitor?.checkedAt ? `Checked ${displayDate(monitor.checkedAt)}` : 'Checking Microsoft Release Plans…'}</span></CardHeader>
        <CardContent className="p-4">
          {monitorLoading ? <div className="py-10 text-center text-sm text-muted-foreground">Checking the latest release-plan changes…</div> : <div className="grid gap-4 xl:grid-cols-3">
            {([['generalAvailability', 'General availability'], ['publicPreview', 'Public preview'], ['planned', 'Planned']] as const).map(([key, title]) => <section key={key} className="overflow-hidden rounded-lg border bg-muted/20"><div className="flex h-10 items-center justify-between border-b bg-background px-3"><h2 className="ui-label">{title}</h2><span className="text-xs text-muted-foreground">{monitor?.columns[key].length || 0}</span></div><div className="space-y-3 p-3">{monitor?.columns[key].length ? monitor.columns[key].map((item) => <article key={item.id} className="data-row rounded-md border bg-background p-3"><div className="flex items-start justify-between gap-3"><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold leading-5 hover:text-primary hover:underline">{item.title}<ExternalLink className="ml-1 inline h-3 w-3" /></a>{item.change && <Badge className="shrink-0">Updated</Badge>}</div>{item.area && <p className="mt-1 text-xs text-muted-foreground">{item.area}</p>}<div className="mt-3 space-y-1 text-xs text-muted-foreground">{item.previewDate && <p>Preview: {item.previewDate}{item.previewStatus ? ` · ${item.previewStatus}` : ''}</p>}{item.gaDate && <p>GA: {item.gaDate}{item.gaStatus ? ` · ${item.gaStatus}` : ''}</p>}{item.lastUpdatedAt && <p>Last updated: {displayDate(item.lastUpdatedAt)}</p>}{item.change && <p className="pt-1 font-medium text-foreground">{item.change.summary}</p>}</div></article>) : <div className="rounded-md border border-dashed px-3 py-7 text-center text-sm text-muted-foreground">No 2026+ features.</div>}</div></section>)}
          </div>}
        </CardContent>
      </Card>

      <NewsStories initialData={initialNews} title="All stories" description="Browse the complete shared newsroom, including older posts." showSourceFilter />
    </div>
  );
}
