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

fs.copyFileSync(path.join(projectRoot, 'assets', 'countries.csv'), path.join(outputRoot, 'countries.csv'));
fs.copyFileSync(path.join(projectRoot, 'assets', 'states.csv'), path.join(outputRoot, 'states.csv'));
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
async function resolveMx(domain) { for (var attempt = 0; attempt < 2; attempt += 1) { try { var response = await fetch('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(domain) + '&type=MX', { headers: { accept: 'application/dns-json' } }); if (!response.ok) continue; var payload = await response.json(); var answers = Array.isArray(payload.Answer) ? payload.Answer : []; return payload.Status === 0 && answers.some(function (answer) { return answer && answer.type === 15 && typeof answer.data === 'string' && answer.data !== '.'; }); } catch (error) {} } throw new Error('MX lookup unavailable.'); }
async function checkMx(request) { if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405); var domain = normalizeDomain(new URL(request.url).searchParams.get('domain')); if (!domain) return json({ error: 'Invalid domain.' }, 400); var cached = mxCache.get(domain); if (cached && cached.expiresAt > Date.now()) return json({ domain: domain, hasMx: cached.hasMx }); try { var hasMx = await resolveMx(domain); mxCache.set(domain, { hasMx: hasMx, expiresAt: Date.now() + 300000 }); return json({ domain: domain, hasMx: hasMx }); } catch (error) { return json({ error: 'MX lookup unavailable.' }, 502); } }
function cleanSimulationText(value, limit) { return typeof value === 'string' ? value.trim().slice(0, limit) : ''; }
function validPersona(value) { return value && typeof value.name === 'string' && typeof value.role === 'string' && ['Positive', 'Mixed', 'Critical'].includes(value.stance); }
async function simulate(request, env) { if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405); var apiKey = env.DEEPSEEK_API_KEY; if (!apiKey) return json({ error: 'Simulation is not configured yet.' }, 503); try { var input = await request.json(); var proposal = cleanSimulationText(input.proposal, 3000); var audience = cleanSimulationText(input.audience, 60); var rounds = Number(input.rounds); var personas = Array.isArray(input.personas) ? input.personas : []; if (!proposal || !audience || ![1, 6, 24].includes(rounds) || personas.length !== 3 || !personas.every(validPersona)) return json({ error: 'The simulation input is incomplete or invalid.' }, 400); var completion = await fetch('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey }, body: JSON.stringify({ model: env.DEEPSEEK_MODEL || 'deepseek-v4-flash', temperature: 0.4, max_tokens: Math.min(3500, 700 + rounds * 95), response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You simulate an independent audience debate. The proposal is the only factual source. Do not invent facts, figures, dates, policies, research, or external context. Personas may express opinions and open questions only. Return valid JSON only.' }, { role: 'user', content: JSON.stringify({ proposal: proposal, audience: audience, personas: personas, rounds: rounds, shape: { timeline: [{ round: 1, author: 'persona name', sentiment: 'Positive | Mixed | Critical', text: 'concise reaction, maximum 180 characters' }], result: { sentiment: 'integer 0 to 100', overallResponse: 'concise summary', keyConcerns: ['one to three concerns raised'], recommendedNextStep: 'specific improvement action' } }, rules: ['Return exactly the requested number of timeline events, numbered from 1.', 'Cycle through the supplied personas in order.', 'Each reaction must use the role as a decision lens.', 'If a detail is absent from the proposal, ask for clarification instead of guessing.', 'The final result must only synthesise the simulated debate and proposal.'] }) }] }), signal: AbortSignal.timeout(45000) }); if (!completion.ok) return json({ error: 'The simulation service could not generate a response. Please try again.' }, 502); var body = await completion.json(); var content = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content; if (!content) throw new Error('Missing content.'); var generated = JSON.parse(content); if (!Array.isArray(generated.timeline) || generated.timeline.length !== rounds || !generated.result) throw new Error('Incomplete response.'); var timeline = generated.timeline.map(function (item, index) { var persona = personas[index % personas.length]; return { round: index + 1, author: personas.some(function (candidate) { return candidate.name === item.author; }) ? item.author : persona.name, sentiment: ['Positive', 'Mixed', 'Critical'].includes(item.sentiment) ? item.sentiment : persona.stance, text: cleanSimulationText(item.text, 220) || (persona.name + ' is weighing the proposal through a ' + persona.role.toLowerCase() + ' perspective.') }; }); var result = generated.result; return json({ timeline: timeline, result: { sentiment: Math.max(0, Math.min(100, Number(result.sentiment) || 50)), overallResponse: cleanSimulationText(result.overallResponse, 180) || 'Audience response is still forming.', keyConcerns: Array.isArray(result.keyConcerns) ? result.keyConcerns.filter(function (item) { return typeof item === 'string' && item.trim(); }).slice(0, 3).map(function (item) { return cleanSimulationText(item, 160); }) : ['The audience needs more detail before reaching a firm view.'], recommendedNextStep: cleanSimulationText(result.recommendedNextStep, 180) || 'Clarify the most important unanswered question before communicating the proposal.' } }); } catch (error) { return json({ error: 'The simulation response could not be processed. Please try again.' }, 502); } }
export default { async fetch(request, env) { var pathname = new URL(request.url).pathname; if (pathname === '/api/mx') return checkMx(request); if (pathname === '/api/simulate') return simulate(request, env || {}); var asset = assets[pathname] || assets[pathname + '/']; if (!asset) return new Response('Not found', { status: 404 }); var extension = pathname.slice(pathname.lastIndexOf('.')); var contentType = pathname === '/' || pathname.endsWith('/') || !extension ? 'text/html; charset=utf-8' : (contentTypes[extension] || 'application/octet-stream'); return new Response(decode(asset), { headers: { 'content-type': contentType } }); } };
`);
fs.copyFileSync(path.join(projectRoot, '.openai', 'hosting.json'), path.join(distRoot, '.openai', 'hosting.json'));
