export type Source = { id: number; name: string };
export type NewsItem = { id: number; sourceId: number; sourceName: string; sourceUrl: string; title: string; summary: string; url: string; publishedAt: number };
export type NewsResponse = { items: NewsItem[]; sources: Source[]; refreshedAt: number };

const upstreamOrigin = (process.env.PATTENS_LOCAL_API_ORIGIN || 'https://pattens.tech').replace(/\/$/, '');
const MEGHAN_FEED_URL = 'https://meganvwalker.com/feed';
const MEGHAN_SOURCE_URL = 'https://meganvwalker.com/';

function cleanText(value: string, limit: number) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function decodeXml(value: string) {
  return cleanText(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'"), 1200);
}

function tagValue(block: string, names: string[]) {
  for (const name of names) {
    const match = new RegExp(`<(?:[a-z0-9_-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-z0-9_-]+:)?${name}>`, 'i').exec(block);
    if (match) return decodeXml(match[1]);
  }
  return '';
}

function parseMeghanFeed(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const expression = /<(?:[a-z0-9_-]+:)?item\b[^>]*>([\s\S]*?)<\/(?:[a-z0-9_-]+:)?item>/gi;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(xml)) && items.length < 20) {
    const block = match[1];
    const url = tagValue(block, ['link']);
    const title = tagValue(block, ['title']);
    const externalId = tagValue(block, ['guid']) || url;
    const publishedAt = Date.parse(tagValue(block, ['pubDate', 'date', 'published']));
    if (!url || !title || !externalId || !/^https:\/\//i.test(url)) continue;
    items.push({ id: -items.length - 1, sourceId: -1, sourceName: 'Meghan', sourceUrl: MEGHAN_SOURCE_URL, title: title.slice(0, 300), summary: tagValue(block, ['description', 'encoded', 'summary']), url, publishedAt: Number.isFinite(publishedAt) ? publishedAt : 0 });
  }
  return items.sort((a, b) => b.publishedAt - a.publishedAt);
}

async function getMeghanNewsData() {
  try {
    const response = await fetch(MEGHAN_FEED_URL, { cache: 'no-store' });
    if (!response.ok) return null;
    return parseMeghanFeed(await response.text());
  } catch {
    return null;
  }
}

export async function getDevelopmentNewsData(): Promise<NewsResponse | null> {
  if (process.env.NODE_ENV !== 'development') return null;

  try {
    const [response, meghanItems] = await Promise.all([fetch(`${upstreamOrigin}/api/news`, { cache: 'no-store' }), getMeghanNewsData()]);
    const dynamicsData = response.ok ? await response.json() as NewsResponse : null;
    if (!dynamicsData && !meghanItems) return null;
    const items = [...(dynamicsData?.items || []), ...(meghanItems || [])].sort((a, b) => b.publishedAt - a.publishedAt);
    const sources = [...(dynamicsData?.sources || []).filter((source) => source.name !== 'Meghan'), ...(meghanItems ? [{ id: -1, name: 'Meghan' }] : [])];
    return { items, sources, refreshedAt: dynamicsData?.refreshedAt || Date.now() };
  } catch {
    return null;
  }
}
