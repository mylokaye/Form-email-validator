var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '..');
var outputRoot = path.join(projectRoot, 'out');
var distRoot = path.join(projectRoot, 'dist');
var assetMap = {};
var contentTypeMap = {
  '.css': 'text/css; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2'
};

function addAssets(directory, prefix) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach(function (entry) {
    var source = path.join(directory, entry.name);
    if (entry.isDirectory()) { addAssets(source, prefix + entry.name + '/'); return; }
    var relativePath = prefix + entry.name;
    var route = relativePath === 'index.html' ? '/' : '/' + relativePath;
    assetMap[route] = fs.readFileSync(source).toString('base64');
    if (entry.name === 'index.html' && relativePath !== 'index.html') {
      assetMap['/' + prefix] = assetMap[route];
      assetMap['/' + prefix.slice(0, -1)] = assetMap[route];
    }
  });
}

var nextBuild = childProcess.spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'build', '--webpack'], { cwd: projectRoot, stdio: 'inherit' });
if (nextBuild.status !== 0) process.exit(nextBuild.status || 1);

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(distRoot, 'server'), { recursive: true });
fs.mkdirSync(path.join(distRoot, '.openai'), { recursive: true });
addAssets(outputRoot, '');

fs.writeFileSync(path.join(distRoot, 'server', 'index.js'), `var assets = ${JSON.stringify(assetMap)};
var contentTypes = ${JSON.stringify(contentTypeMap)};
var mxCache = new Map();
function decode(value) { var binary = atob(value); var bytes = new Uint8Array(binary.length); for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i); return bytes; }
function json(value, status) { return new Response(JSON.stringify(value), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }
function normalizeDomain(value) { if (typeof value !== 'string') return null; var domain = value.toLowerCase().replace(/\\.$/, ''); if (!domain || domain.length > 253 || !domain.includes('.')) return null; var labels = domain.split('.'); if (labels.some(function (label) { return !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label); })) return null; return domain; }
async function checkMx(request) { if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405); var domain = normalizeDomain(new URL(request.url).searchParams.get('domain')); if (!domain) return json({ error: 'Invalid domain.' }, 400); var cached = mxCache.get(domain); if (cached && cached.expiresAt > Date.now()) return json({ domain: domain, hasMx: cached.hasMx }); try { var response = await fetch('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(domain) + '&type=MX', { headers: { accept: 'application/dns-json' } }); if (!response.ok) throw new Error('Resolver request failed.'); var payload = await response.json(); var answers = Array.isArray(payload.Answer) ? payload.Answer : []; var hasMx = payload.Status === 0 && answers.some(function (answer) { return answer && answer.type === 15 && typeof answer.data === 'string' && answer.data !== '.'; }); mxCache.set(domain, { hasMx: hasMx, expiresAt: Date.now() + 300000 }); return json({ domain: domain, hasMx: hasMx }); } catch (error) { return json({ error: 'MX lookup unavailable.' }, 502); } }
export default { async fetch(request) { var pathname = new URL(request.url).pathname; if (pathname === '/api/mx') return checkMx(request); var asset = assets[pathname] || assets[pathname + '/']; if (!asset) return new Response('Not found', { status: 404 }); var extension = pathname.slice(pathname.lastIndexOf('.')); var contentType = pathname === '/' || pathname.endsWith('/') || !extension ? 'text/html; charset=utf-8' : (contentTypes[extension] || 'application/octet-stream'); return new Response(decode(asset), { headers: { 'content-type': contentType } }); } };
`);
fs.copyFileSync(path.join(projectRoot, '.openai', 'hosting.json'), path.join(distRoot, '.openai', 'hosting.json'));
