var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '..');
var distRoot = path.join(projectRoot, 'dist');

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(distRoot, 'server'), { recursive: true });
fs.mkdirSync(path.join(distRoot, '.openai'), { recursive: true });

['index.html', 'app.js', 'generate.js', 'src', 'assets'].forEach(function (entry) {
  var source = path.join(projectRoot, entry);
  var destination = path.join(distRoot, entry);
  fs.cpSync(source, destination, { recursive: true });
});

fs.writeFileSync(
  path.join(distRoot, 'server', 'index.js'),
  "export default { async fetch(request, env) { return env.ASSETS.fetch(request); } };\n"
);

fs.copyFileSync(
  path.join(projectRoot, '.openai', 'hosting.json'),
  path.join(distRoot, '.openai', 'hosting.json')
);
