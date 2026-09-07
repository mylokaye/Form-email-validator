var NEWS_CACHE_MS = 15 * 60 * 1000;
var NEWS_ITEMS_PER_SOURCE = 20;
var NEWS_RESPONSE_LIMIT = 100;
var NEWS_REFRESH_PER_REQUEST = 3;
var NEWS_DEFAULT_SOURCES = [
  { name: 'Meghan', homepageUrl: 'https://meganvwalker.com/', feedUrl: 'https://meganvwalker.com/feed/' },
  { name: 'Amey Holden', homepageUrl: 'https://www.ameyholden.com/articles/', feedUrl: 'https://www.ameyholden.com/articles?format=rss' },
];
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
  for (var defaultIndex = 0; defaultIndex < NEWS_DEFAULT_SOURCES.length; defaultIndex += 1) {
    var defaultSource = NEWS_DEFAULT_SOURCES[defaultIndex];
    var feedUrls = [defaultSource.feedUrl];
    if (defaultSource.name === 'Meghan') feedUrls.unshift('https://meganvwalker.com/feed');
    var defaultSources = newsRows(await db.prepare('SELECT id, feed_url, (SELECT COUNT(*) FROM feed_items WHERE feed_items.source_id = feed_sources.id) AS item_count FROM feed_sources WHERE feed_url IN (?, ?) ORDER BY item_count DESC, id ASC').bind(feedUrls[0], feedUrls[1] || feedUrls[0]).all());
    if (defaultSources.length) {
      var primarySourceId = Number(defaultSources[0].id);
      for (var sourceIndex = 1; sourceIndex < defaultSources.length; sourceIndex += 1) {
        var duplicateSourceId = Number(defaultSources[sourceIndex].id);
        await db.batch([
          db.prepare('DELETE FROM feed_items WHERE source_id = ?').bind(duplicateSourceId),
          db.prepare('DELETE FROM feed_sources WHERE id = ?').bind(duplicateSourceId),
        ]);
      }
      await db.prepare('UPDATE feed_sources SET name = ?, homepage_url = ?, feed_url = ? WHERE id = ?').bind(defaultSource.name, defaultSource.homepageUrl, defaultSource.feedUrl, primarySourceId).run();
    } else {
      await db.prepare('INSERT INTO feed_sources (name, homepage_url, feed_url, is_active, last_checked_at, last_error, created_at, updated_at) VALUES (?, ?, ?, 1, NULL, NULL, ?, ?)').bind(defaultSource.name, defaultSource.homepageUrl, defaultSource.feedUrl, newsNow(), newsNow()).run();
    }
  }
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

function xmlBlocks(xml, name, limit) {
  var expression = new RegExp('<(?:[a-z0-9_-]+:)?' + name + '\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-z0-9_-]+:)?' + name + '>', 'gi');
  var blocks = [];
  var match;
  while ((match = expression.exec(xml)) && blocks.length < (limit || NEWS_ITEMS_PER_SOURCE)) blocks.push(match[1]);
  return blocks;
}

function xmlTags(block, name) {
  var expression = new RegExp('<(?:[a-z0-9_-]+:)?' + name + '\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-z0-9_-]+:)?' + name + '>', 'gi');
  var values = [];
  var match;
  while ((match = expression.exec(block))) values.push(decodeXml(match[1]));
  return values;
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

async function fetchNewsUrl(value, accept, maxBytes) {
  var url = normaliseNewsUrl(value);
  var responseLimit = maxBytes || 1024 * 1024;
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
    if (contentLength > responseLimit) throw new Error('The source response is too large.');
    var text = await response.text();
    if (text.length > responseLimit) throw new Error('The source response is too large.');
    return { text: text, url: url };
  }
  throw new Error('The source redirected too many times.');
}

function parseFeed(xml, feedUrl, limit) {
  var isAtom = /<feed[\s>]/i.test(xml);
  var maxItems = limit || NEWS_ITEMS_PER_SOURCE;
  var blocks = xmlBlocks(xml, isAtom ? 'entry' : 'item', maxItems);
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
    var published = Date.parse(xmlTag(block, isAtom ? ['published', 'date', 'updated'] : ['pubDate', 'date', 'published']));
    var updated = Date.parse(xmlTag(block, ['updated', 'modified'])) || published;
    articles.push({ externalId: cleanNewsText(externalId, 500), publishedAt: Number.isFinite(published) ? published : newsNow(), updatedAt: Number.isFinite(updated) ? updated : (Number.isFinite(published) ? published : newsNow()), categories: xmlTags(block, 'category'), summary: xmlTag(block, isAtom ? ['summary', 'content'] : ['description', 'encoded', 'summary']), title: cleanNewsText(title, 300), url: url });
  });
  return articles.slice(0, maxItems);
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
  if (pathname === '/api/news/sources') {
    if (request.method === 'GET') return json({ sources: await listNewsSources(env) });
    if (request.method === 'POST') return newsError('Adding new sources is disabled.', 405);
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
