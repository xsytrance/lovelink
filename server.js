const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const url = require('url');
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const SESSION_SECRET = process.env.SESSION_SECRET || 'lovelink-secret';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || (COOKIE_SECURE ? 'None' : 'Lax');
const USERS = {
Snooky: 'Gomez143!',
Agenor: 'Gomez143!!'
};
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(__dirname, 'lovelink.json');
const state = {
sessions: new Map(),
clients: new Map(),
presence: {
hostId: null,
viewerId: null,
online: 0,
usernames: {}
},
startTime: Date.now()
};
function getDb() {
if (!fs.existsSync(DB_FILE)) {
fs.writeFileSync(DB_FILE, JSON.stringify({ moments: [] }, null, 2));
}
return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
async function saveDb(db) {
await fsp.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}
function setCors(res, req) {
const origin = req?.headers?.origin;
if (origin) {
res.setHeader('Access-Control-Allow-Origin', origin);
res.setHeader('Vary', 'Origin');
} else {
res.setHeader('Access-Control-Allow-Origin', '*');
}
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');
res.setHeader('Access-Control-Allow-Credentials', 'true');
}
function json(req, res, code, payload) {
setCors(res, req);
res.writeHead(code, {
'Content-Type': 'application/json'
});
res.end(JSON.stringify(payload));
}
function sendCorsHeaders(req, res) {
setCors(res, req);
}
function parseCookies(req) {
const cookie = req.headers.cookie || '';
const out = {};
cookie.split(';').forEach((part) => {
const [k, ...rest] = part.trim().split('=');
if (!k) return;
out[k] = decodeURIComponent(rest.join('='));
});
return out;
}
function sign(value) {
return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}
function createSession(username) {
const sid = crypto.randomBytes(18).toString('hex');
state.sessions.set(sid, { username, authenticated: true, createdAt: Date.now() });
return sid;
}
function getSession(req) {
const cookies = parseCookies(req);
const raw = cookies.lovelink_session;
if (!raw) return null;
const [sid, sig] = raw.split('.');
if (!sid || !sig || sign(sid) !== sig) return null;
return state.sessions.get(sid) || null;
}
function parseBody(req) {
return new Promise((resolve, reject) => {
let data = '';
req.on('data', (chunk) => {
data += chunk;
if (data.length > 12 * 1024 * 1024) {
reject(new Error('Payload too large'));
req.destroy();
}
});
req.on('end', () => {
try {
resolve(data ? JSON.parse(data) : {});
} catch {
reject(new Error('Invalid JSON'));
}
});
req.on('error', reject);
});
}
function sendEvent(type, payload) {
const msg = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
state.clients.forEach((client) => client.res.write(msg));
}
function emitPresence() {
sendEvent('presence', {
hostConnected: Boolean(state.presence.hostId),
viewerConnected: Boolean(state.presence.viewerId),
viewersOnline: state.presence.online
});
}
function serveFile(req, reqPath, res) {
let p = reqPath === '/' ? '/index.html' : reqPath;
const filePath = path.normalize(path.join(PUBLIC_DIR, p));
if (!filePath.startsWith(PUBLIC_DIR)) return json(req, res, 403, { error: 'Forbidden' });
if (!fs.existsSync(filePath)) return json(req, res, 404, { error: 'Not found' });
const ext = path.extname(filePath);
const contentType = {
'.html': 'text/html; charset=utf-8',
'.js': 'application/javascript; charset=utf-8',
'.css': 'text/css; charset=utf-8',
'.json': 'application/json; charset=utf-8',
'.png': 'image/png',
'.jpg': 'image/jpeg',
'.jpeg': 'image/jpeg',
'.svg': 'image/svg+xml',
'.ico': 'image/x-icon',
'.webmanifest': 'application/manifest+json'
}[ext] || 'application/octet-stream';
setCors(res, req);
res.writeHead(200, {
'Content-Type': contentType
});
fs.createReadStream(filePath).pipe(res);
}
const server = http.createServer(async (req, res) => {
const parsed = url.parse(req.url, true);
const pathname = parsed.pathname;
// Handle CORS preflight
if (req.method === 'OPTIONS') {
sendCorsHeaders(req, res);
res.writeHead(204);
res.end();
return;
}
// Health check endpoint
if (pathname === '/health' && req.method === 'GET') {
setCors(res, req);
res.writeHead(200, {
'Content-Type': 'application/json'
});
res.end(JSON.stringify({
status: 'ok',
uptime: Date.now() - state.startTime,
presence: {
hostConnected: Boolean(state.presence.hostId),
viewerConnected: Boolean(state.presence.viewerId),
viewersOnline: state.presence.online
},
version: '1.0.0'
}));
return;
}
// API status endpoint
if (pathname === '/api/status' && req.method === 'GET') {
const db = getDb();
setCors(res, req);
res.writeHead(200, {
'Content-Type': 'application/json'
});
res.end(JSON.stringify({
ok: true,
server: 'LoveLink',
version: '1.0.0',
timestamp: Date.now(),
stats: {
moments: db.moments.length,
viewersOnline: state.presence.online,
hostConnected: Boolean(state.presence.hostId),
viewerConnected: Boolean(state.presence.viewerId)
}
}));
return;
}
if (pathname === '/events' && req.method === 'GET') {
const session = getSession(req);
if (!session?.authenticated) return json(req, res, 401, { error: 'Unauthorized' });
const id = crypto.randomBytes(8).toString('hex');
setCors(res, req);
res.writeHead(200, {
'Content-Type': 'text/event-stream',
'Cache-Control': 'no-cache',
Connection: 'keep-alive'
});
state.clients.set(id, { res, username: session.username });
state.presence.online += 1;
emitPresence();
req.on('close', () => {
state.clients.delete(id);
state.presence.online = Math.max(0, state.presence.online - 1);
if (state.presence.hostId === id) state.presence.hostId = null;
if (state.presence.viewerId === id) {
state.presence.viewerId = null;
sendEvent('viewer-status', { message: 'Snooky disconnected' });
}
emitPresence();
});
return;
}
if (pathname === '/api/login' && req.method === 'POST') {
const body = await parseBody(req).catch(() => null);
if (!body) return json(req, res, 400, { error: 'Invalid JSON' });
const username = body.username || 'Snooky';
if (!USERS[username]) return json(req, res, 401, { error: 'Invalid user' });
if (body.password !== USERS[username]) return json(req, res, 401, { error: 'Invalid password' });
const sid = createSession(username);
const securePart = COOKIE_SECURE ? '; Secure' : '';
res.setHeader('Set-Cookie', `lovelink_session=${sid}.${sign(sid)}; HttpOnly; SameSite=${COOKIE_SAMESITE}; Path=/${securePart}`);
return json(req, res, 200, { ok: true, username });
}
if (pathname === '/api/session' && req.method === 'GET') {
const session = getSession(req);
if (!session?.authenticated) return json(req, res, 200, { authenticated: false });
return json(req, res, 200, { authenticated: true, username: session.username });
}
const session = getSession(req);
if (pathname.startsWith('/api/') && !session?.authenticated) {
return json(req, res, 401, { error: 'Unauthorized' });
}
if (pathname === '/api/moments' && req.method === 'GET') {
const db = getDb();
return json(req, res, 200, { moments: db.moments.sort((a, b) => b.timestamp - a.timestamp) });
}
if (pathname === '/api/moments' && req.method === 'POST') {
const body = await parseBody(req).catch(() => null);
if (!body?.imageData?.startsWith('data:image/')) return json(req, res, 400, { error: 'Invalid image payload' });
const db = getDb();
const moment = {
id: crypto.randomBytes(8).toString('hex'),
imageData: body.imageData,
timestamp: Date.now(),
capturedBy: body.capturedBy || session.username,
reactions: {},
comments: []
};
db.moments.push(moment);
await saveDb(db);
sendEvent('moment-captured', { id: moment.id, timestamp: moment.timestamp, capturedBy: moment.capturedBy });
return json(req, res, 200, { ok: true, moment });
}
if (pathname.match(/^\/api\/moments\/[^/]+$/) && req.method === 'DELETE') {
const id = pathname.split('/')[3];
const db = getDb();
const before = db.moments.length;
db.moments = db.moments.filter((m) => m.id !== id);
if (db.moments.length === before) return json(req, res, 404, { error: 'Moment not found' });
await saveDb(db);
return json(req, res, 200, { ok: true });
}
if (pathname.match(/^\/api\/moments\/[^/]+\/reaction$/) && req.method === 'POST') {
const id = pathname.split('/')[3];
const body = await parseBody(req).catch(() => null);
if (!body?.reaction) return json(req, res, 400, { error: 'Reaction required' });
const db = getDb();
const moment = db.moments.find((m) => m.id === id);
if (!moment) return json(req, res, 404, { error: 'Moment not found' });
moment.reactions[body.reaction] = (moment.reactions[body.reaction] || 0) + 1;
await saveDb(db);
return json(req, res, 200, { ok: true, reactions: moment.reactions });
}
if (pathname.match(/^\/api\/moments\/[^/]+\/comment$/) && req.method === 'POST') {
const id = pathname.split('/')[3];
const body = await parseBody(req).catch(() => null);
if (!body?.text) return json(req, res, 400, { error: 'Comment text required' });
const db = getDb();
const moment = db.moments.find((m) => m.id === id);
if (!moment) return json(req, res, 404, { error: 'Moment not found' });
moment.comments.push({ author: session.username, text: body.text, timestamp: Date.now() });
await saveDb(db);
return json(req, res, 200, { ok: true, comments: moment.comments });
}
if (pathname === '/api/event' && req.method === 'POST') {
const body = await parseBody(req).catch(() => null);
if (!body?.type) return json(req, res, 400, { error: 'Event type required' });
if (body.type === 'set-role') {
if (body.role === 'host') state.presence.hostId = body.clientId;
if (body.role === 'viewer') {
state.presence.viewerId = body.clientId;
sendEvent('viewer-status', { message: 'Snooky is watching ❤️' });
sendEvent('signal', { from: body.clientId, type: 'viewer-ready' });
}
emitPresence();
}
if (body.type === 'signal') sendEvent('signal', body.payload);
if (body.type === 'chat-message') sendEvent('chat-message', { ...body.payload, timestamp: Date.now() });
if (body.type === 'typing') sendEvent('typing', body.payload);
if (body.type === 'reaction') sendEvent('reaction', body.payload);
if (body.type === 'miss-you') sendEvent('miss-you', { message: 'Snooky sent you a ❤️', timestamp: Date.now() });
if (body.type === 'mood') sendEvent('mood', body.payload);
return json(req, res, 200, { ok: true });
}
if (pathname === '/api/logout' && req.method === 'POST') {
const cookie = parseCookies(req).lovelink_session;
if (cookie) {
state.sessions.delete(cookie.split('.')[0]);
res.setHeader('Set-Cookie', 'lovelink_session=; HttpOnly; Path=/; Max-Age=0');
}
return json(req, res, 200, { ok: true });
}
if (!pathname.startsWith('/api/')) return serveFile(req, pathname, res);
return json(req, res, 404, { error: 'Not found' });
});
server.listen(PORT, HOST, () => {
console.log(`LoveLink server running on http://${HOST}:${PORT}`);
console.log(`Health check: http://${HOST}:${PORT}/health`);
console.log(`API status:   http://${HOST}:${PORT}/api/status`);
});
