'use client';

import Link from 'next/link';
import { ExternalLink, RefreshCw, Rss } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Source = { id: number; name: string; homepageUrl: string };
type NewsItem = { id: number; sourceId: number; sourceName: string; sourceUrl: string; title: string; summary: string; url: string; publishedAt: number };
type NewsResponse = { items: NewsItem[]; sources: Source[]; refreshedAt: number };

function displayDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}

export function NewsWorkspace() {
  const [data, setData] = useState<NewsResponse>({ items: [], sources: [], refreshedAt: 0 });
  const [selectedSource, setSelectedSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground"><Rss className="h-4 w-4" />Shared newsroom</div>
          <h1 className="text-2xl font-semibold tracking-tight">Latest news</h1>
          <p className="mt-1 text-sm text-muted-foreground">Recent stories from the sites Pattens follows.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="news-source">Filter by source</label>
          <select id="news-source" value={selectedSource} onChange={(event) => { setSelectedSource(event.target.value); void load(event.target.value); }} className="h-[50px] min-w-44 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <option value="">All sources</option>
            {data.sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
          </select>
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} />Refresh</Button>
        </div>
      </div>

      {error && <Card className="border-destructive/30 bg-destructive/5"><CardContent className="py-1 text-sm text-destructive" role="alert">{error}</CardContent></Card>}

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
