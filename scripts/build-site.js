var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '..');
var distRoot = path.join(projectRoot, 'dist');
var assetMap = {};
var contentTypeMap = {
  '.csv': 'text/csv; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function addAssets(directory, prefix) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach(function (entry) {
    var source = path.join(directory, entry.name);
    var assetPath = prefix + entry.name;
    if (entry.isDirectory()) {
      addAssets(source, assetPath + '/');
      return;
    }
    assetMap[assetPath] = fs.readFileSync(source).toString('base64');
  });
}

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(distRoot, 'server'), { recursive: true });
fs.mkdirSync(path.join(distRoot, '.openai'), { recursive: true });

['index.html', 'app.js', 'generate.js', 'src', 'assets'].forEach(function (entry) {
  var source = path.join(projectRoot, entry);
  var destination = path.join(distRoot, entry);
  fs.cpSync(source, destination, { recursive: true });
});

assetMap['/'] = fs.readFileSync(path.join(projectRoot, 'index.html')).toString('base64');
['app.js', 'generate.js', 'src', 'assets'].forEach(function (entry) {
  var source = path.join(projectRoot, entry);
  if (fs.statSync(source).isDirectory()) {
    addAssets(source, '/' + entry + '/');
  } else {
    assetMap['/' + entry] = fs.readFileSync(source).toString('base64');
  }
});

fs.writeFileSync(
  path.join(distRoot, 'server', 'index.js'),
  "var assets = " + JSON.stringify(assetMap) + ";\n" +
  "var contentTypes = " + JSON.stringify(contentTypeMap) + ";\n" +
  "function decode(value) { var binary = atob(value); var bytes = new Uint8Array(binary.length); for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i); return bytes; }\n" +
  "export default { async fetch(request) { var pathname = new URL(request.url).pathname; var asset = assets[pathname]; if (!asset) return new Response('Not found', { status: 404 }); var extension = pathname.slice(pathname.lastIndexOf('.')); var contentType = pathname === '/' ? 'text/html; charset=utf-8' : (contentTypes[extension] || 'application/octet-stream'); return new Response(decode(asset), { headers: { 'content-type': contentType } }); } };\n"
);

fs.copyFileSync(
  path.join(projectRoot, '.openai', 'hosting.json'),
  path.join(distRoot, '.openai', 'hosting.json')
);
