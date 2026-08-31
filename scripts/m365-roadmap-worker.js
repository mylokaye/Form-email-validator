var M365_ROADMAP_FEED_URL = 'https://www.microsoft.com/releasecommunications/api/v2/m365/rss';
var M365_ROADMAP_SOURCE_URL = 'https://www.microsoft.com/microsoft-365/roadmap';
var M365_ROADMAP_CACHE_MS = 15 * 60 * 1000;
var m365RoadmapCache = { expiresAt: 0, payload: null };

function m365RoadmapStatus(categories) {
  return categories.find(function (category) { return ['In development', 'Rolling out', 'Launched'].includes(category); }) || '';
}

async function handleM365Roadmap(request) {
  if (request.method !== 'GET') return newsError('Method not allowed.', 405);
  var now = Date.now();
  if (m365RoadmapCache.payload && m365RoadmapCache.expiresAt > now) return json(m365RoadmapCache.payload);
  try {
    var fetched = await fetchNewsUrl(M365_ROADMAP_FEED_URL, 'application/rss+xml, application/atom+xml, application/xml, text/xml', 5 * 1024 * 1024);
    var items = parseFeed(fetched.text, fetched.url, 500).map(function (item) {
      return { id: item.externalId, title: item.title, summary: item.summary, url: item.url, publishedAt: item.publishedAt, updatedAt: item.updatedAt, categories: item.categories, status: m365RoadmapStatus(item.categories) };
    }).sort(function (a, b) { return b.updatedAt - a.updatedAt || b.publishedAt - a.publishedAt; }).slice(0, 100);
    var payload = { items: items, sourceName: 'Microsoft 365 Roadmap', sourceUrl: M365_ROADMAP_SOURCE_URL, refreshedAt: now };
    m365RoadmapCache = { expiresAt: now + M365_ROADMAP_CACHE_MS, payload: payload };
    return json(payload);
  } catch (error) {
    return newsError(cleanNewsText(error instanceof Error ? error.message : 'The Microsoft 365 roadmap feed is temporarily unavailable.', 240), 503);
  }
}
