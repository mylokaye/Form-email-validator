'use client';

import { useEffect, useState } from 'react';
import { Check, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Source = { id: number; name: string; homepageUrl: string; feedUrl: string; isActive: boolean; lastCheckedAt: number | null; lastError: string | null };
function displayCheck(timestamp: number | null) {
  return timestamp ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp)) : 'Not checked yet';
}

function SourceRow({ source, onChange, onDelete, onRefresh }: { source: Source; onChange: (source: Source) => void; onDelete: (id: number) => void; onRefresh: (id: number) => void }) {
  const [name, setName] = useState(source.name);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/news/sources/${source.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, isActive: source.isActive }) });
      const payload = await response.json() as { source?: Source; error?: string };
      if (!response.ok || !payload.source) throw new Error(payload.error || 'Could not save this source.');
      onChange(payload.source);
    } finally { setSaving(false); }
  };
  return <article className="store-row flex flex-col gap-4 border-b py-4 last:border-b-0 md:flex-row md:items-start md:justify-between">
    <div className="min-w-0 flex-1 space-y-2"><div className="flex flex-col gap-2 sm:flex-row"><Input value={name} onChange={(event) => setName(event.target.value)} aria-label={`Source name for ${source.name}`} /><Button type="button" variant="secondary" onClick={() => void save()} disabled={saving || name.trim() === source.name}><Check />Save</Button></div><div className="space-y-1 text-xs text-muted-foreground"><a href={source.homepageUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate hover:text-foreground hover:underline">{source.feedUrl}<ExternalLink className="h-3 w-3 shrink-0" /></a><p>Last checked: {displayCheck(source.lastCheckedAt)}</p>{source.lastError && <p className="text-destructive">Last error: {source.lastError}</p>}</div></div>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => onRefresh(source.id)}><RefreshCw />Refresh</Button><Button type="button" variant="destructive" onClick={() => onDelete(source.id)}><Trash2 />Remove</Button></div>
  </article>;
}

export function NewsManager() {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const response = await fetch('/api/news/sources');
      const payload = await response.json() as { sources?: Source[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Sources could not be loaded.');
      setSources(payload.sources || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Sources could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const update = (next: Source) => setSources((current) => current.map((source) => source.id === next.id ? next : source));
  const remove = async (id: number) => { if (!window.confirm('Remove this shared news source?')) return; const response = await fetch(`/api/news/sources/${id}`, { method: 'DELETE' }); if (response.ok) setSources((current) => current.filter((source) => source.id !== id)); else setError('Could not remove this source.'); };
  const refresh = async (id: number) => { const response = await fetch(`/api/news/sources/${id}/refresh`, { method: 'POST' }); const payload = await response.json() as { source?: Source; error?: string }; if (!response.ok || !payload.source) setError(payload.error || 'Could not refresh this source.'); else update(payload.source); };

  if (loading) return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading shared sources…</CardContent></Card>;

  return <div className="space-y-6"><div><p className="text-sm font-medium text-muted-foreground">Shared newsroom</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Manage shared sources</h1><p className="mt-1 text-sm text-muted-foreground">Existing sources can be refreshed or updated. New sources are maintained in the Pattens deployment.</p></div>{error && <Card className="border-destructive/30 bg-destructive/5"><CardContent className="py-1 text-sm text-destructive" role="alert">{error}</CardContent></Card>}<Card><CardHeader className="border-b"><CardTitle>Sources</CardTitle></CardHeader><CardContent>{sources.length ? sources.map((source) => <SourceRow key={source.id} source={source} onChange={update} onDelete={(id) => void remove(id)} onRefresh={(id) => void refresh(id)} />) : <p className="py-8 text-center text-sm text-muted-foreground">No sources yet.</p>}</CardContent></Card></div>;
}
