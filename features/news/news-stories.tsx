'use client';

import Link from 'next/link';
import { ArrowRight, ExternalLink, RefreshCw, Rss } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { NewsResponse } from '@/features/news/news-data';

type NewsStoriesProps = {
  initialData?: NewsResponse | null;
  limit?: number;
  sourceFilterLabels?: Record<string, string>;
  title: string;
  description: string;
  showViewAll?: boolean;
  showSourceFilter?: boolean;
};

function displayDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(timestamp));
}

function displayTitle(title: string, shouldClip: boolean) {
  if (!shouldClip) return title;
  const words = title.trim().split(/\s+/);
  return words.length > 6 ? `${words.slice(0, 6).join(' ')}...` : title;
}

export function NewsStories({ initialData, limit, sourceFilterLabels, title, description, showViewAll = false, showSourceFilter = false }: NewsStoriesProps) {
  const [data, setData] = useState<NewsResponse>(initialData ?? { items: [], sources: [], refreshedAt: 0 });
  const [selectedSource, setSelectedSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (source = selectedSource) => {
    setLoading(true);
    setError('');
    if (initialData) {
      setData({ ...initialData, items: source ? initialData.items.filter((item) => String(item.sourceId) === source) : initialData.items });
      setLoading(false);
      return;
    }
    try {
      const query = source ? `?source=${encodeURIComponent(source)}` : '';
      const response = await fetch(`/api/news${query}`);
      const payload = await response.json() as NewsResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'News could not be loaded.');
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'News could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialData) {
      setLoading(false);
      return;
    }
    void load('');
  }, [initialData]);

  const visibleItems = typeof limit === 'number' ? data.items.slice(0, limit) : data.items;

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <CardDescription className="mt-1">{description}</CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showViewAll && <Button nativeButton={false} variant="link" size="sm" render={<Link href="/news/" />}>View all<ArrowRight data-icon="inline-end" /></Button>}
        </div>
      </CardHeader>

      {showSourceFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex flex-wrap items-center gap-1 rounded-full border border-input bg-muted/45 p-1" role="group" aria-label="Filter latest news">
            <span className="sr-only">Filter latest news</span>
            {[{ id: '', label: 'All' }, ...data.sources.map((source) => ({ id: String(source.id), label: sourceFilterLabels?.[source.name] || source.name }))].map((option) => (
              <Button key={option.id || 'all'} type="button" variant="ghost" size="sm" aria-pressed={selectedSource === option.id} onClick={() => { setSelectedSource(option.id); void load(option.id); }} className={`h-7 rounded-full px-3 text-xs ${selectedSource === option.id ? 'bg-background text-foreground shadow-sm hover:bg-background' : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'}`}>
                {option.label}
              </Button>
            ))}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw data-icon="inline-start" className={loading ? 'animate-spin' : undefined} />Refresh</Button>
        </div>
      )}

      <CardContent className="p-4">
        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{error}</div>}
        {loading && <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">Refreshing the latest stories…</div>}
        {!loading && !error && visibleItems.length === 0 && <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center"><Rss className="size-7 text-muted-foreground" /><p className="font-medium">The newsroom is getting ready.</p><p className="max-w-sm text-sm text-muted-foreground">Stories will appear here once a shared RSS or Atom source is added.</p>{showSourceFilter && <Link href="/news/manage/" className="mt-2 text-sm font-medium text-primary hover:underline">Manage sources</Link>}</div>}
        {!loading && !error && visibleItems.length > 0 && (
          <div className={limit ? 'grid gap-4 md:grid-cols-3' : 'grid gap-4 lg:grid-cols-2'}>
            {visibleItems.map((item) => (
              <Card key={item.id} size="sm" className="h-full bg-background/45 transition-colors hover:bg-muted/40">
                <CardContent className="flex h-full flex-col gap-4 p-4">
                  <a href={item.url} target="_blank" rel="noreferrer" className="group flex flex-1 flex-col gap-2"><h2 className="text-base font-semibold leading-6 group-hover:text-primary">{displayTitle(item.title, typeof limit === 'number')}{' '}<ExternalLink className="ml-1.5 inline size-3.5" /></h2>{item.summary && <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">{item.summary}</p>}</a>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-foreground hover:underline">{item.sourceName}</a><span aria-hidden="true">·</span><span>{displayDate(item.publishedAt)}</span></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
