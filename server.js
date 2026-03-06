const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.LOVE_LINK_PASSWORD || 'lovelink';
const SESSION_SECRET = process.env.SESSION_SECRET || 'lovelink-secret';

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
  }
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

function json(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
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

function serveFile(reqPath, res) {
  let p = reqPath === '/' ? '/index.html' : reqPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, p));
  if (!filePath.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'Forbidden' });
  if (!fs.existsSync(filePath)) return json(res, 404, { error: 'Not found' });
  const ext = path.extname(filePath);
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (pathname === '/events' && req.method === 'GET') {
    const session = getSession(req);
    if (!session?.authenticated) return json(res, 401, { error: 'Unauthorized' });
    const id = crypto.randomBytes(8).toString('hex');
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
    if (!body) return json(res, 400, { error: 'Invalid JSON' });
    if (body.password !== PASSWORD) return json(res, 401, { error: 'Invalid password' });
    const username = body.username || 'Snooky';
    const sid = createSession(username);
    res.setHeader('Set-Cookie', `lovelink_session=${sid}.${sign(sid)}; HttpOnly; SameSite=Lax; Path=/`);
    return json(res, 200, { ok: true, username });
  }

  if (pathname === '/api/session' && req.method === 'GET') {
    const session = getSession(req);
    if (!session?.authenticated) return json(res, 200, { authenticated: false });
    return json(res, 200, { authenticated: true, username: session.username });
  }

  const session = getSession(req);
  if (pathname.startsWith('/api/') && !session?.authenticated) {
    return json(res, 401, { error: 'Unauthorized' });
  }

  if (pathname === '/api/moments' && req.method === 'GET') {
    const db = getDb();
    return json(res, 200, { moments: db.moments.sort((a, b) => b.timestamp - a.timestamp) });
  }

  if (pathname === '/api/moments' && req.method === 'POST') {
    const body = await parseBody(req).catch(() => null);
    if (!body?.imageData?.startsWith('data:image/')) return json(res, 400, { error: 'Invalid image payload' });
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
    return json(res, 200, { ok: true, moment });
  }

  if (pathname.match(/^\/api\/moments\/[^/]+\/reaction$/) && req.method === 'POST') {
    const id = pathname.split('/')[3];
    const body = await parseBody(req).catch(() => null);
    if (!body?.reaction) return json(res, 400, { error: 'Reaction required' });
    const db = getDb();
    const moment = db.moments.find((m) => m.id === id);
    if (!moment) return json(res, 404, { error: 'Moment not found' });
    moment.reactions[body.reaction] = (moment.reactions[body.reaction] || 0) + 1;
    await saveDb(db);
    return json(res, 200, { ok: true, reactions: moment.reactions });
  }

  if (pathname.match(/^\/api\/moments\/[^/]+\/comment$/) && req.method === 'POST') {
    const id = pathname.split('/')[3];
    const body = await parseBody(req).catch(() => null);
    if (!body?.text) return json(res, 400, { error: 'Comment text required' });
    const db = getDb();
    const moment = db.moments.find((m) => m.id === id);
    if (!moment) return json(res, 404, { error: 'Moment not found' });
    moment.comments.push({ author: session.username, text: body.text, timestamp: Date.now() });
    await saveDb(db);
    return json(res, 200, { ok: true, comments: moment.comments });
  }

  if (pathname === '/api/event' && req.method === 'POST') {
    const body = await parseBody(req).catch(() => null);
    if (!body?.type) return json(res, 400, { error: 'Event type required' });

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

    return json(res, 200, { ok: true });
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    const cookie = parseCookies(req).lovelink_session;
    if (cookie) {
      state.sessions.delete(cookie.split('.')[0]);
      res.setHeader('Set-Cookie', 'lovelink_session=; HttpOnly; Path=/; Max-Age=0');
    }
    return json(res, 200, { ok: true });
  }

  if (!pathname.startsWith('/api/')) return serveFile(pathname, res);
  return json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`LoveLink server running on http://localhost:${PORT}`);
});
