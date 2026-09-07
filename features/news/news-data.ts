export type Source = { id: number; name: string };
export type NewsItem = { id: number; sourceId: number; sourceName: string; sourceUrl: string; title: string; summary: string; url: string; publishedAt: number };
export type NewsResponse = { items: NewsItem[]; sources: Source[]; refreshedAt: number };

const upstreamOrigin = (process.env.PATTENS_LOCAL_API_ORIGIN || 'https://pattens.tech').replace(/\/$/, '');
const BLOG_FEEDS = [
  { id: -1, name: 'Meghan', sourceUrl: 'https://meganvwalker.com/', feedUrl: 'https://meganvwalker.com/feed' },
  { id: -2, name: 'Amey Holden', sourceUrl: 'https://www.ameyholden.com/articles/', feedUrl: 'https://www.ameyholden.com/articles?format=rss' },
] as const;

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

function parseBlogFeed(xml: string, source: (typeof BLOG_FEEDS)[number]): NewsItem[] {
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
    items.push({ id: source.id * 1000 - items.length, sourceId: source.id, sourceName: source.name, sourceUrl: source.sourceUrl, title: title.slice(0, 300), summary: tagValue(block, ['description', 'encoded', 'summary']), url, publishedAt: Number.isFinite(publishedAt) ? publishedAt : 0 });
  }
  return items.sort((a, b) => b.publishedAt - a.publishedAt);
}

async function getBlogNewsData(source: (typeof BLOG_FEEDS)[number]) {
  try {
    const response = await fetch(source.feedUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    return parseBlogFeed(await response.text(), source);
  } catch {
    return null;
  }
}

export async function getDevelopmentNewsData(): Promise<NewsResponse | null> {
  if (process.env.NODE_ENV !== 'development') return null;

  try {
    const [response, ...blogItems] = await Promise.all([fetch(`${upstreamOrigin}/api/news`, { cache: 'no-store' }), ...BLOG_FEEDS.map((source) => getBlogNewsData(source))]);
    const dynamicsData = response.ok ? await response.json() as NewsResponse : null;
    const blogNames = new Set<string>(BLOG_FEEDS.map((source) => source.name));
    const availableBlogItems = blogItems.flatMap((items) => items || []);
    if (!dynamicsData && !availableBlogItems.length) return null;
    const items = [...(dynamicsData?.items || []).filter((item) => !blogNames.has(item.sourceName)), ...availableBlogItems].sort((a, b) => b.publishedAt - a.publishedAt);
    const sources = [...(dynamicsData?.sources || []).filter((source) => !blogNames.has(source.name)), ...BLOG_FEEDS.filter((source) => availableBlogItems.some((item) => item.sourceId === source.id)).map((source) => ({ id: source.id, name: source.name }))];
    return { items, sources, refreshedAt: dynamicsData?.refreshedAt || Date.now() };
  } catch {
    return null;
  }
}
