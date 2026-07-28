var RELEASE_MONITOR_CACHE_MS = 6 * 60 * 60 * 1000;
var RELEASE_MONITOR_RECENT_MS = 30 * 24 * 60 * 60 * 1000;
var RELEASE_MONITOR_MIN_YEAR = 2026;
var RELEASE_MONITOR_SCHEMA_VERSION = 'release-monitor-v2';
var RELEASE_MONITOR_PRODUCT_ID = '940fa520-7756-ee11-be6f-000d3a574715';
var RELEASE_MONITOR_SOURCE_URL = 'https://releaseplans.microsoft.com/en-us/?app=Customer+Insights+-+Journeys';
var RELEASE_MONITOR_DATA_URL = 'https://releaseplans.microsoft.com/releaseplanner-json/?productId=' + RELEASE_MONITOR_PRODUCT_ID + '&langCode=en-US';
var releaseMonitorSchemaReady = false;

function releaseMonitorDb(env) {
  if (!env || !env.DB) throw new Error('Release monitor storage is not configured.');
  return env.DB;
}

function releaseMonitorRows(result) { return result && Array.isArray(result.results) ? result.results : []; }
function releaseMonitorText(value, limit) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit); }
function releaseMonitorDate(value) { var timestamp = Date.parse(value); return Number.isFinite(timestamp) ? timestamp : null; }
function releaseMonitorYear(value) { var timestamp = releaseMonitorDate(value); return timestamp ? new Date(timestamp).getUTCFullYear() : 0; }
function releaseMonitorWaveYear(value) { var match = /\b(20\d{2})\b/.exec(String(value || '')); return match ? Number(match[1]) : 0; }

async function ensureReleaseMonitorSchema(env) {
  if (releaseMonitorSchemaReady) return;
  var db = releaseMonitorDb(env);
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS release_monitor_state (id INTEGER PRIMARY KEY CHECK (id = 1), last_checked_at INTEGER, last_error TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS release_monitor_features (feature_id TEXT PRIMARY KEY, title TEXT NOT NULL, area TEXT, source_url TEXT NOT NULL, preview_date TEXT, ga_date TEXT, preview_status TEXT, ga_status TEXT, last_updated_at INTEGER, fingerprint TEXT NOT NULL, first_seen_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS release_monitor_changes (id INTEGER PRIMARY KEY AUTOINCREMENT, feature_id TEXT NOT NULL, change_type TEXT NOT NULL, summary TEXT NOT NULL, detected_at INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS release_monitor_changes_detected_at_idx ON release_monitor_changes(detected_at DESC)'),
  ]);
  releaseMonitorSchemaReady = true;
}

function releaseMonitorRecord(item) {
  var previewDate = releaseMonitorText(item.PublicPreviewDate, 32);
  var gaDate = releaseMonitorText(item.GADate, 32);
  var lastUpdatedAt = releaseMonitorDate(item.GitCommitDate) || releaseMonitorDate(item.Createdon) || null;
  var relevantYear = Math.max(releaseMonitorYear(previewDate), releaseMonitorYear(gaDate), releaseMonitorYear(item.EarlyAccessDate), releaseMonitorWaveYear(item.ReleaseWaveName), releaseMonitorWaveYear(item.GAReleaseWaveName));
  if (relevantYear < RELEASE_MONITOR_MIN_YEAR) return null;
  var record = {
    featureId: releaseMonitorText(item.ReleasePlanID || item.SnapshotId, 120),
    title: releaseMonitorText(item.FeatureName, 300),
    area: releaseMonitorText(item.ProductArea, 160),
    sourceUrl: releaseMonitorText(item.DocsUrl, 2048) || RELEASE_MONITOR_SOURCE_URL,
    previewDate: previewDate,
    gaDate: gaDate,
    previewStatus: releaseMonitorText(item.PPStatus, 40),
    gaStatus: releaseMonitorText(item.GAStatus, 40),
    lastUpdatedAt: lastUpdatedAt,
  };
  if (!record.featureId || !record.title) return null;
  record.fingerprint = JSON.stringify([record.title, record.area, record.previewDate, record.gaDate, record.previewStatus, record.gaStatus, record.sourceUrl]);
  return record;
}

function releaseMonitorColumn(feature) {
  if (feature.gaDate) return 'generalAvailability';
  if (feature.previewDate) return 'publicPreview';
  return 'planned';
}

function releaseMonitorChangeSummary(previous, next) {
  if (!previous) return 'New feature added to the release plan.';
  var changed = [];
  if (previous.preview_date !== next.previewDate) changed.push('Public preview date changed');
  if (previous.ga_date !== next.gaDate) changed.push('General availability date changed');
  if (previous.preview_status !== next.previewStatus || previous.ga_status !== next.gaStatus) changed.push('Release status changed');
  if (previous.title !== next.title || previous.area !== next.area) changed.push('Feature details changed');
  return changed.length ? changed.join(' · ') : 'Feature details changed';
}

async function fetchReleaseMonitorRecords() {
  var response = await fetch(RELEASE_MONITOR_DATA_URL, { headers: { accept: 'application/json', 'user-agent': 'Pattens Release Monitor/1.0' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Microsoft Release Plans returned HTTP ' + response.status + '.');
  var payload = await response.json();
  if (!payload || !Array.isArray(payload.results)) throw new Error('Microsoft Release Plans returned an unexpected response.');
  return payload.results.map(releaseMonitorRecord).filter(Boolean);
}

async function refreshReleaseMonitor(env) {
  var db = releaseMonitorDb(env); var now = Date.now(); var records = await fetchReleaseMonitorRecords();
  var existing = releaseMonitorRows(await db.prepare('SELECT feature_id, title, area, preview_date, ga_date, preview_status, ga_status, fingerprint FROM release_monitor_features').all());
  var byId = new Map(existing.map(function (row) { return [row.feature_id, row]; }));
  var statements = [];
  records.forEach(function (record) {
    var previous = byId.get(record.featureId);
    statements.push(db.prepare('INSERT INTO release_monitor_features (feature_id, title, area, source_url, preview_date, ga_date, preview_status, ga_status, last_updated_at, fingerprint, first_seen_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(feature_id) DO UPDATE SET title = excluded.title, area = excluded.area, source_url = excluded.source_url, preview_date = excluded.preview_date, ga_date = excluded.ga_date, preview_status = excluded.preview_status, ga_status = excluded.ga_status, last_updated_at = excluded.last_updated_at, fingerprint = excluded.fingerprint, updated_at = excluded.updated_at').bind(record.featureId, record.title, record.area || null, record.sourceUrl, record.previewDate || null, record.gaDate || null, record.previewStatus || null, record.gaStatus || null, record.lastUpdatedAt, record.fingerprint, now, now));
    if (previous && previous.fingerprint !== record.fingerprint) statements.push(db.prepare('INSERT INTO release_monitor_changes (feature_id, change_type, summary, detected_at) VALUES (?, ?, ?, ?)').bind(record.featureId, 'changed', releaseMonitorChangeSummary(previous, record), now));
  });
  if (records.length) {
    var placeholders = records.map(function () { return '?'; }).join(', ');
    var ids = records.map(function (record) { return record.featureId; });
    var deleteChanges = db.prepare('DELETE FROM release_monitor_changes WHERE feature_id NOT IN (' + placeholders + ')');
    var deleteFeatures = db.prepare('DELETE FROM release_monitor_features WHERE feature_id NOT IN (' + placeholders + ')');
    statements.push(deleteChanges.bind.apply(deleteChanges, ids));
    statements.push(deleteFeatures.bind.apply(deleteFeatures, ids));
  }
  if (statements.length) await db.batch(statements);
  await db.prepare('INSERT INTO release_monitor_state (id, last_checked_at, last_error) VALUES (1, ?, NULL) ON CONFLICT(id) DO UPDATE SET last_checked_at = excluded.last_checked_at, last_error = NULL').bind(now).run();
  await db.prepare('INSERT INTO release_monitor_state (id, last_checked_at, last_error) VALUES (2, ?, ?) ON CONFLICT(id) DO UPDATE SET last_checked_at = excluded.last_checked_at, last_error = excluded.last_error').bind(now, RELEASE_MONITOR_SCHEMA_VERSION).run();
}

async function releaseMonitorStatus(env) {
  var rows = releaseMonitorRows(await releaseMonitorDb(env).prepare('SELECT last_checked_at, last_error FROM release_monitor_state WHERE id = 1').all());
  return rows[0] || { last_checked_at: null, last_error: null };
}

async function releaseMonitorPayload(env) {
  var db = releaseMonitorDb(env); var now = Date.now();
  var features = releaseMonitorRows(await db.prepare('SELECT feature_id, title, area, source_url, preview_date, ga_date, preview_status, ga_status, last_updated_at FROM release_monitor_features ORDER BY COALESCE(last_updated_at, 0) DESC, title COLLATE NOCASE').all());
  var changes = releaseMonitorRows(await db.prepare('SELECT feature_id, change_type, summary, detected_at FROM release_monitor_changes WHERE detected_at >= ? ORDER BY detected_at DESC LIMIT 100').bind(now - RELEASE_MONITOR_RECENT_MS).all());
  var changesByFeature = new Map();
  changes.forEach(function (change) { if (!changesByFeature.has(change.feature_id)) changesByFeature.set(change.feature_id, change); });
  var columns = { generalAvailability: [], publicPreview: [], planned: [] };
  features.forEach(function (feature) {
    var change = changesByFeature.get(feature.feature_id);
    var item = { id: feature.feature_id, title: feature.title, area: feature.area || '', sourceUrl: feature.source_url, previewDate: feature.preview_date || '', gaDate: feature.ga_date || '', previewStatus: feature.preview_status || '', gaStatus: feature.ga_status || '', lastUpdatedAt: feature.last_updated_at ? Number(feature.last_updated_at) : null, change: change ? { summary: change.summary, detectedAt: Number(change.detected_at) } : null };
    columns[releaseMonitorColumn(item)].push(item);
  });
  return { sourceUrl: RELEASE_MONITOR_SOURCE_URL, columns: columns, changes: changes.map(function (change) { return { featureId: change.feature_id, summary: change.summary, detectedAt: Number(change.detected_at) }; }), checkedAt: null };
}

async function handleReleaseMonitor(request, env) {
  if (request.method !== 'GET') return newsError('Method not allowed.', 405);
  await ensureReleaseMonitorSchema(env);
  var status = await releaseMonitorStatus(env); var now = Date.now();
  var versionRow = releaseMonitorRows(await releaseMonitorDb(env).prepare('SELECT last_error FROM release_monitor_state WHERE id = 2').all())[0];
  if (!status.last_checked_at || !versionRow || versionRow.last_error !== RELEASE_MONITOR_SCHEMA_VERSION || now - Number(status.last_checked_at) >= RELEASE_MONITOR_CACHE_MS) {
    try { await refreshReleaseMonitor(env); } catch (error) { await releaseMonitorDb(env).prepare('INSERT INTO release_monitor_state (id, last_checked_at, last_error) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET last_checked_at = excluded.last_checked_at, last_error = excluded.last_error').bind(now, releaseMonitorText(error instanceof Error ? error.message : 'Could not check Microsoft Release Plans.', 240)).run(); }
  }
  var payload = await releaseMonitorPayload(env); var latestStatus = await releaseMonitorStatus(env); payload.checkedAt = latestStatus.last_checked_at ? Number(latestStatus.last_checked_at) : null; payload.lastError = latestStatus.last_error || null;
  return json(payload);
}
