var NEWS_CACHE_MS = 15 * 60 * 1000;
var NEWS_MAX_SOURCES = 25;
var NEWS_ITEMS_PER_SOURCE = 20;
var NEWS_RESPONSE_LIMIT = 100;
var NEWS_REFRESH_PER_REQUEST = 3;
var newsSchemaReady = false;

function newsError(message, status) { return json({ error: message }, status || 400); }

function newsDb(env) {
  if (!env || !env.DB) throw new Error('News storage is not configured.');
  return env.DB;
}

async function ensureNewsSchema(env) {
  if (newsSchemaReady) return;
  var db = newsDb(env);
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS feed_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, homepage_url TEXT NOT NULL, feed_url TEXT NOT NULL UNIQUE, is_active INTEGER NOT NULL DEFAULT 1, last_checked_at INTEGER, last_error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS feed_sources_last_checked_at_idx ON feed_sources(last_checked_at)'),
    db.prepare('CREATE TABLE IF NOT EXISTS feed_items (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id INTEGER NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE, external_id TEXT NOT NULL, url TEXT NOT NULL, title TEXT NOT NULL, summary TEXT, published_at INTEGER NOT NULL, created_at INTEGER NOT NULL, UNIQUE(source_id, external_id))'),
    db.prepare('CREATE INDEX IF NOT EXISTS feed_items_published_at_idx ON feed_items(published_at)'),
  ]);
  newsSchemaReady = true;
}

function newsRows(result) { return result && Array.isArray(result.results) ? result.results : []; }
function newsNow() { return Date.now(); }
function cleanNewsText(value, limit) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit); }

function decodeXml(value) {
  return cleanNewsText(String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'"), 1200);
}

function xmlBlocks(xml, name) {
  var expression = new RegExp('<(?:[a-z0-9_-]+:)?' + name + '\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-z0-9_-]+:)?' + name + '>', 'gi');
  var blocks = [];
  var match;
  while ((match = expression.exec(xml)) && blocks.length < NEWS_ITEMS_PER_SOURCE) blocks.push(match[1]);
  return blocks;
}

function xmlTag(block, names) {
  for (var index = 0; index < names.length; index += 1) {
    var name = names[index];
    var expression = new RegExp('<(?:[a-z0-9_-]+:)?' + name + '\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-z0-9_-]+:)?' + name + '>', 'i');
    var match = expression.exec(block);
    if (match) return decodeXml(match[1]);
  }
  return '';
}

function xmlAttribute(tag, attribute) {
  var expression = new RegExp(attribute + '\\s*=\\s*["\\\']([^"\\\']+)["\\\']', 'i');
  var match = expression.exec(tag);
  return match ? decodeXml(match[1]) : '';
}

function normaliseNewsUrl(value, base) {
  try {
    var url = new URL(value, base);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || isPrivateNewsHost(url.hostname)) return null;
    return url.toString();
  } catch (error) { return null; }
}

function isPrivateNewsHost(hostname) {
  var host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
  var ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  var first = Number(ipv4[1]); var second = Number(ipv4[2]);
  return first === 0 || first === 10 || first === 127 || first === 169 && second === 254 || first === 172 && second >= 16 && second <= 31 || first === 192 && second === 168;
}

async function fetchNewsUrl(value, accept) {
  var url = normaliseNewsUrl(value);
  if (!url) throw new Error('Use a public HTTPS URL.');
  for (var attempt = 0; attempt < 4; attempt += 1) {
    var response = await fetch(url, { headers: { accept: accept, 'user-agent': 'Pattens News Feed/1.0' }, redirect: 'manual', signal: AbortSignal.timeout(8000) });
    if (response.status >= 300 && response.status < 400) {
      url = normaliseNewsUrl(response.headers.get('location') || '', url);
      if (!url) throw new Error('The source redirected to an unsupported address.');
      continue;
    }
    if (!response.ok) throw new Error('The source returned HTTP ' + response.status + '.');
    var contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 1024 * 1024) throw new Error('The source response is too large.');
    var text = await response.text();
    if (text.length > 1024 * 1024) throw new Error('The source response is too large.');
    return { text: text, url: url };
  }
  throw new Error('The source redirected too many times.');
}

function parseFeed(xml, feedUrl) {
  var isAtom = /<feed[\s>]/i.test(xml);
  var blocks = xmlBlocks(xml, isAtom ? 'entry' : 'item');
  var articles = [];
  blocks.forEach(function (block) {
    var title = xmlTag(block, ['title']);
    var link = '';
    if (isAtom) {
      var links = block.match(/<(?:[a-z0-9_-]+:)?link\b[^>]*>/gi) || [];
      for (var index = 0; index < links.length; index += 1) {
        var rel = xmlAttribute(links[index], 'rel');
        var href = xmlAttribute(links[index], 'href');
        if (href && (!rel || rel === 'alternate')) { link = href; break; }
      }
    } else link = xmlTag(block, ['link']);
    var url = normaliseNewsUrl(link, feedUrl);
    if (!title || !url) return;
    var externalId = xmlTag(block, isAtom ? ['id'] : ['guid']) || url;
    var published = Date.parse(xmlTag(block, isAtom ? ['published', 'updated', 'date'] : ['pubDate', 'date', 'published', 'updated']));
    articles.push({ externalId: cleanNewsText(externalId, 500), publishedAt: Number.isFinite(published) ? published : newsNow(), summary: xmlTag(block, isAtom ? ['summary', 'content'] : ['description', 'encoded', 'summary']), title: cleanNewsText(title, 300), url: url });
  });
  return articles.slice(0, NEWS_ITEMS_PER_SOURCE);
}

function sourceNameFromHtml(html, fallback) {
  var og = /<meta\b[^>]*(?:property|name)=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(html) || /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:site_name["'][^>]*>/i.exec(html);
  var title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return cleanNewsText((og && og[1]) || (title && decodeXml(title[1])) || fallback, 120);
}

async function discoverNewsSource(value) {
  var first = await fetchNewsUrl(value, 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9');
  var directArticles = parseFeed(first.text, first.url);
  if (directArticles.length) return { feedUrl: first.url, homepageUrl: new URL(first.url).origin + '/', name: new URL(first.url).hostname, articles: directArticles };
  var links = first.text.match(/<link\b[^>]*>/gi) || [];
  for (var index = 0; index < links.length; index += 1) {
    var tag = links[index];
    var rel = xmlAttribute(tag, 'rel').toLowerCase();
    var type = xmlAttribute(tag, 'type').toLowerCase();
    var href = xmlAttribute(tag, 'href');
    if (href && rel.includes('alternate') && (type.includes('rss') || type.includes('atom') || type.includes('xml'))) {
      var feedUrl = normaliseNewsUrl(href, first.url);
      if (!feedUrl) continue;
      var feed = await fetchNewsUrl(feedUrl, 'application/rss+xml, application/atom+xml, application/xml, text/xml');
      var articles = parseFeed(feed.text, feed.url);
      if (articles.length) return { feedUrl: feed.url, homepageUrl: first.url, name: sourceNameFromHtml(first.text, new URL(first.url).hostname), articles: articles };
    }
  }
  throw new Error('No public RSS or Atom feed was found at that address.');
}

function sourceFromRow(row) {
  return { id: Number(row.id), name: row.name, homepageUrl: row.homepage_url, feedUrl: row.feed_url, isActive: Boolean(row.is_active), lastCheckedAt: row.last_checked_at ? Number(row.last_checked_at) : null, lastError: row.last_error || null };
}

async function listNewsSources(env) {
  await ensureNewsSchema(env);
  var result = await newsDb(env).prepare('SELECT id, name, homepage_url, feed_url, is_active, last_checked_at, last_error FROM feed_sources ORDER BY name COLLATE NOCASE').all();
  return newsRows(result).map(sourceFromRow);
}

async function storeNewsArticles(env, source, articles) {
  var db = newsDb(env); var now = newsNow(); var statements = [];
  articles.forEach(function (article) {
    statements.push(db.prepare('INSERT OR IGNORE INTO feed_items (source_id, external_id, url, title, summary, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(source.id, article.externalId, article.url, article.title, article.summary || null, article.publishedAt, now));
  });
  statements.push(db.prepare('DELETE FROM feed_items WHERE source_id = ? AND id NOT IN (SELECT id FROM feed_items WHERE source_id = ? ORDER BY published_at DESC, id DESC LIMIT ?)').bind(source.id, source.id, NEWS_ITEMS_PER_SOURCE));
  if (statements.length) await db.batch(statements);
}

async function refreshNewsSource(env, source) {
  try {
    var fetched = await fetchNewsUrl(source.feedUrl, 'application/rss+xml, application/atom+xml, application/xml, text/xml');
    var articles = parseFeed(fetched.text, fetched.url);
    if (!articles.length) throw new Error('The feed did not contain any usable articles.');
    await storeNewsArticles(env, source, articles);
    await newsDb(env).prepare('UPDATE feed_sources SET feed_url = ?, last_checked_at = ?, last_error = NULL, updated_at = ? WHERE id = ?').bind(fetched.url, newsNow(), newsNow(), source.id).run();
    return { ok: true };
  } catch (error) {
    var message = cleanNewsText(error instanceof Error ? error.message : 'Could not refresh this source.', 240);
    await newsDb(env).prepare('UPDATE feed_sources SET last_checked_at = ?, last_error = ?, updated_at = ? WHERE id = ?').bind(newsNow(), message, newsNow(), source.id).run();
    return { ok: false, error: message };
  }
}

async function refreshStaleNews(env, sourceId) {
  var sources = await listNewsSources(env);
  var now = newsNow();
  var candidates = sources.filter(function (source) { return source.isActive && (!source.lastCheckedAt || now - source.lastCheckedAt >= NEWS_CACHE_MS) && (!sourceId || source.id === sourceId); }).sort(function (a, b) { return (a.lastCheckedAt || 0) - (b.lastCheckedAt || 0); }).slice(0, sourceId ? 1 : NEWS_REFRESH_PER_REQUEST);
  await Promise.all(candidates.map(function (source) { return refreshNewsSource(env, source); }));
}

function isNewsOwner(request, env) {
  var owner = cleanNewsText(env && env.NEWS_OWNER_EMAIL, 254).toLowerCase();
  var user = cleanNewsText(request.headers.get('oai-authenticated-user-email'), 254).toLowerCase();
  return Boolean(owner && user && owner === user);
}

async function handlePublicNews(request, env) {
  if (request.method !== 'GET') return newsError('Method not allowed.', 405);
  var url = new URL(request.url); var sourceId = Number(url.searchParams.get('source') || 0) || 0;
  await refreshStaleNews(env, sourceId || null);
  var db = newsDb(env);
  var query = 'SELECT feed_items.id, feed_items.url, feed_items.title, feed_items.summary, feed_items.published_at, feed_sources.id AS source_id, feed_sources.name AS source_name, feed_sources.homepage_url FROM feed_items INNER JOIN feed_sources ON feed_sources.id = feed_items.source_id WHERE feed_sources.is_active = 1';
  var statement = sourceId ? db.prepare(query + ' AND feed_sources.id = ? ORDER BY feed_items.published_at DESC, feed_items.id DESC LIMIT ?').bind(sourceId, NEWS_RESPONSE_LIMIT) : db.prepare(query + ' ORDER BY feed_items.published_at DESC, feed_items.id DESC LIMIT ?').bind(NEWS_RESPONSE_LIMIT);
  var rows = newsRows(await statement.all());
  var sources = await listNewsSources(env);
  return json({ items: rows.map(function (row) { return { id: Number(row.id), sourceId: Number(row.source_id), sourceName: row.source_name, sourceUrl: row.homepage_url, title: row.title, summary: row.summary || '', url: row.url, publishedAt: Number(row.published_at) }; }), sources: sources.filter(function (source) { return source.isActive; }), refreshedAt: newsNow() });
}

async function requireNewsOwner(request, env) {
  if (!isNewsOwner(request, env)) return newsError(request.headers.get('oai-authenticated-user-email') ? 'This account cannot manage shared sources.' : 'Sign in with ChatGPT to manage shared sources.', request.headers.get('oai-authenticated-user-email') ? 403 : 401);
  return null;
}

async function addNewsSource(request, env) {
  var payload = await request.json(); var input = cleanNewsText(payload && payload.url, 2048); var customName = cleanNewsText(payload && payload.name, 120);
  if (!input) return newsError('Enter a website or RSS/Atom URL.');
  var existing = await listNewsSources(env);
  if (existing.length >= NEWS_MAX_SOURCES) return newsError('The shared board already has the maximum of ' + NEWS_MAX_SOURCES + ' sources.', 409);
  var discovered;
  try { discovered = await discoverNewsSource(input); } catch (error) { return newsError(cleanNewsText(error instanceof Error ? error.message : 'Could not add this source.', 240)); }
  var now = newsNow(); var name = customName || discovered.name;
  try {
    var created = await newsDb(env).prepare('INSERT INTO feed_sources (name, homepage_url, feed_url, is_active, last_checked_at, last_error, created_at, updated_at) VALUES (?, ?, ?, 1, ?, NULL, ?, ?) RETURNING id, name, homepage_url, feed_url, is_active, last_checked_at, last_error').bind(name, discovered.homepageUrl, discovered.feedUrl, now, now, now).all();
    var source = sourceFromRow(newsRows(created)[0]); await storeNewsArticles(env, source, discovered.articles); return json({ source: source }, 201);
  } catch (error) { return newsError('That feed is already on the shared board.', 409); }
}

async function updateNewsSource(request, env, id) {
  var payload = await request.json(); var sources = await listNewsSources(env); var source = sources.find(function (item) { return item.id === id; });
  if (!source) return newsError('Source not found.', 404);
  var name = cleanNewsText(payload && payload.name, 120) || source.name; var active = payload && typeof payload.isActive === 'boolean' ? payload.isActive : source.isActive;
  await newsDb(env).prepare('UPDATE feed_sources SET name = ?, is_active = ?, updated_at = ? WHERE id = ?').bind(name, active ? 1 : 0, newsNow(), id).run();
  return json({ source: (await listNewsSources(env)).find(function (item) { return item.id === id; }) });
}

async function deleteNewsSource(env, id) {
  var db = newsDb(env); await db.batch([db.prepare('DELETE FROM feed_items WHERE source_id = ?').bind(id), db.prepare('DELETE FROM feed_sources WHERE id = ?').bind(id)]); return new Response(null, { status: 204, headers: securityHeaders('text/plain; charset=utf-8') });
}

async function handleNewsSources(request, env, pathname) {
  var denied = await requireNewsOwner(request, env); if (denied) return denied;
  if (pathname === '/api/news/sources') {
    if (request.method === 'GET') return json({ sources: await listNewsSources(env) });
    if (request.method === 'POST') return addNewsSource(request, env);
    return newsError('Method not allowed.', 405);
  }
  var match = /^\/api\/news\/sources\/(\d+)(\/refresh)?$/.exec(pathname);
  if (!match) return newsError('Not found.', 404);
  var id = Number(match[1]);
  if (match[2] && request.method === 'POST') { await refreshStaleNews(env, id); return json({ source: (await listNewsSources(env)).find(function (item) { return item.id === id; }) || null }); }
  if (request.method === 'PATCH') return updateNewsSource(request, env, id);
  if (request.method === 'DELETE') return deleteNewsSource(env, id);
  return newsError('Method not allowed.', 405);
}

async function checkNews(request, env) {
  try {
    await ensureNewsSchema(env);
    var pathname = new URL(request.url).pathname;
    if (pathname === '/api/news') return handlePublicNews(request, env);
    if (pathname.indexOf('/api/news/sources') === 0) return handleNewsSources(request, env, pathname);
    return newsError('Not found.', 404);
  } catch (error) {
    return newsError(cleanNewsText(error instanceof Error ? error.message : 'News is temporarily unavailable.', 240), 503);
  }
}
