export type RoadmapItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: number;
  updatedAt: number;
  categories: string[];
  status: string;
};

export type RoadmapResponse = {
  items: RoadmapItem[];
  sourceName: string;
  sourceUrl: string;
  refreshedAt: number;
};

export const M365_ROADMAP_FEED_URL = 'https://www.microsoft.com/releasecommunications/api/v2/m365/rss';
export const M365_ROADMAP_SOURCE_URL = 'https://www.microsoft.com/microsoft-365/roadmap';

const statuses = ['In development', 'Rolling out', 'Launched'];

function cleanText(value: string, limit: number) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function decodeXml(value: string) {
  return cleanText(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'"), 1200);
}

function tagValue(block: string, name: string) {
  const match = new RegExp(`<(?:[a-z0-9_-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-z0-9_-]+:)?${name}>`, 'i').exec(block);
  return match ? decodeXml(match[1]) : '';
}

function tagValues(block: string, name: string) {
  const expression = new RegExp(`<(?:[a-z0-9_-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-z0-9_-]+:)?${name}>`, 'gi');
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = expression.exec(block))) values.push(decodeXml(match[1]));
  return values;
}

function parseRoadmapFeed(xml: string): RoadmapItem[] {
  const items: RoadmapItem[] = [];
  const expression = /<(?:[a-z0-9_-]+:)?item\b[^>]*>([\s\S]*?)<\/(?:[a-z0-9_-]+:)?item>/gi;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(xml)) && items.length < 500) {
    const block = match[1];
    const id = tagValue(block, 'guid');
    const title = tagValue(block, 'title');
    const url = tagValue(block, 'link');
    if (!id || !title || !url) continue;
    const publishedAt = Date.parse(tagValue(block, 'pubDate'));
    const updatedAt = Date.parse(tagValue(block, 'updated')) || publishedAt;
    const categories = tagValues(block, 'category');
    items.push({
      id,
      title: title.slice(0, 300),
      summary: tagValue(block, 'description'),
      url,
      publishedAt: Number.isFinite(publishedAt) ? publishedAt : Date.now(),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : (Number.isFinite(publishedAt) ? publishedAt : Date.now()),
      categories,
      status: categories.find((category) => statuses.includes(category)) || '',
    });
  }
  return items.sort((a, b) => b.updatedAt - a.updatedAt || b.publishedAt - a.publishedAt).slice(0, 100);
}

export async function getDevelopmentRoadmapData(): Promise<RoadmapResponse | null> {
  if (process.env.NODE_ENV !== 'development') return null;
  try {
    const response = await fetch(M365_ROADMAP_FEED_URL, { cache: 'no-store' });
    if (!response.ok) return null;
    return { items: parseRoadmapFeed(await response.text()), sourceName: 'Microsoft 365 Roadmap', sourceUrl: M365_ROADMAP_SOURCE_URL, refreshedAt: Date.now() };
  } catch {
    return null;
  }
}
