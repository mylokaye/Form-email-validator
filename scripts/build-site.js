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

fs.writeFileSync(path.join(distRoot, 'server', 'index.js'),
  'var assets = ' + JSON.stringify(assetMap) + ';\n' +
  'var contentTypes = ' + JSON.stringify(contentTypeMap) + ';\n' +
  'function decode(value) { var binary = atob(value); var bytes = new Uint8Array(binary.length); for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i); return bytes; }\n' +
  "export default { async fetch(request) { var pathname = new URL(request.url).pathname; var asset = assets[pathname] || assets[pathname + '/']; if (!asset) return new Response('Not found', { status: 404 }); var extension = pathname.slice(pathname.lastIndexOf('.')); var contentType = pathname === '/' || pathname.endsWith('/') || !extension ? 'text/html; charset=utf-8' : (contentTypes[extension] || 'application/octet-stream'); return new Response(decode(asset), { headers: { 'content-type': contentType } }); } };\n"
);
fs.copyFileSync(path.join(projectRoot, '.openai', 'hosting.json'), path.join(distRoot, '.openai', 'hosting.json'));
