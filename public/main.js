let username = 'Snooky';
let role = null;
let localStream = null;
let peerConnection = null;
let eventSource = null;

function createClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

let clientId = createClientId();

const iceConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const el = {
  loginCard: document.getElementById('loginCard'),
  appRoot: document.getElementById('appRoot'),
  username: document.getElementById('username'),
  password: document.getElementById('password'),
  loginBtn: document.getElementById('loginBtn'),
  loginError: document.getElementById('loginError'),
  presence: document.getElementById('presence'),
  viewerStatus: document.getElementById('viewerStatus'),
  hostBtn: document.getElementById('hostBtn'),
  viewerBtn: document.getElementById('viewerBtn'),
  localVideo: document.getElementById('localVideo'),
  remoteVideo: document.getElementById('remoteVideo'),
  captureBtn: document.getElementById('captureBtn'),
  moments: document.getElementById('moments'),
  chatLog: document.getElementById('chatLog'),
  chatInput: document.getElementById('chatInput'),
  sendBtn: document.getElementById('sendBtn'),
  typingIndicator: document.getElementById('typingIndicator'),
  missYouBtn: document.getElementById('missYouBtn'),
  moodSelect: document.getElementById('moodSelect'),
  sendMoodBtn: document.getElementById('sendMoodBtn')
};

async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const sendEvent = (type, payload = {}) => api('/api/event', 'POST', { type, payload, clientId, role });

async function checkSession() {
  const session = await api('/api/session');
  if (session.authenticated) {
    username = session.username || 'Snooky';
    onAuthenticated();
  }
}

function onAuthenticated() {
  el.loginCard.classList.add('hidden');
  el.appRoot.classList.remove('hidden');
  connectEvents();
  loadMoments();
}

function connectEvents() {
  eventSource = new EventSource('/events');

  const on = (name, fn) => eventSource.addEventListener(name, (e) => fn(JSON.parse(e.data)));

  on('presence', ({ hostConnected, viewerConnected, viewersOnline }) => {
    el.presence.textContent = `Host: ${hostConnected ? 'Online' : 'Offline'} · Viewer: ${viewerConnected ? 'Watching' : 'Away'} · Connected: ${viewersOnline}`;
  });

  on('viewer-status', ({ message }) => {
    el.viewerStatus.textContent = message;
  });

  on('chat-message', ({ text, username: who, timestamp }) => {
    const item = document.createElement('div');
    item.textContent = `[${new Date(timestamp).toLocaleTimeString()}] ${who}: ${text}`;
    el.chatLog.prepend(item);
  });

  on('typing', ({ username: who, clientId: from }) => {
    if (from === clientId) return;
    el.typingIndicator.textContent = `${who} is typing...`;
    setTimeout(() => (el.typingIndicator.textContent = ''), 1200);
  });

  on('reaction', ({ emoji, username: who }) => {
    const item = document.createElement('div');
    item.textContent = `${who} reacted ${emoji}`;
    el.chatLog.prepend(item);
  });

  on('miss-you', ({ message }) => {
    const item = document.createElement('div');
    item.textContent = message;
    el.chatLog.prepend(item);
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.textContent = '❤️';
    heart.style.left = `${Math.random() * 90 + 5}%`;
    heart.style.bottom = '20px';
    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 2000);
  });

  on('mood', ({ value, username: who }) => {
    const item = document.createElement('div');
    item.textContent = `${who}: ${value}`;
    el.chatLog.prepend(item);
  });

  on('moment-captured', () => loadMoments());

  on('signal', async (data) => {
    if (data.to && data.to !== clientId) return;

    if (data.type === 'viewer-ready' && role === 'host' && localStream) {
      setupPeerConnection();
      localStream.getTracks().forEach((t) => peerConnection.addTrack(t, localStream));
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await sendEvent('signal', { type: 'offer', offer, from: clientId, to: data.from || data.clientId });
    }

    if (data.type === 'offer' && role === 'viewer') {
      setupPeerConnection();
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await sendEvent('signal', { type: 'answer', answer, from: clientId, to: data.from });
    }

    if (data.type === 'answer' && peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }

    if (data.type === 'ice' && peerConnection && data.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  });
}

el.loginBtn.onclick = async () => {
  try {
    username = el.username.value || 'Snooky';
    await api('/api/login', 'POST', { username, password: el.password.value });
    onAuthenticated();
  } catch (err) {
    el.loginError.textContent = err.message;
  }
};

function setupPeerConnection() {
  peerConnection = new RTCPeerConnection(iceConfig);
  peerConnection.ontrack = (event) => {
    el.remoteVideo.srcObject = event.streams[0];
    el.remoteVideo.classList.remove('hidden');
  };
  peerConnection.onicecandidate = async (e) => {
    if (e.candidate) {
      await sendEvent('signal', { type: 'ice', candidate: e.candidate, from: clientId });
    }
  };
}

el.hostBtn.onclick = async () => {
  role = 'host';
  await sendEvent('set-role', { role, clientId });
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  el.localVideo.srcObject = localStream;
  el.localVideo.classList.remove('hidden');
  el.remoteVideo.classList.add('hidden');
  el.viewerStatus.textContent = 'Host is live. Waiting for Snooky...';
};

el.viewerBtn.onclick = async () => {
  role = 'viewer';
  await sendEvent('set-role', { role, clientId });
  el.localVideo.classList.add('hidden');
  el.remoteVideo.classList.remove('hidden');
};

el.captureBtn.onclick = async () => {
  const sourceVideo = role === 'host' ? el.localVideo : el.remoteVideo;
  if (!sourceVideo.srcObject) return;
  const canvas = document.createElement('canvas');
  canvas.width = sourceVideo.videoWidth || 640;
  canvas.height = sourceVideo.videoHeight || 360;
  canvas.getContext('2d').drawImage(sourceVideo, 0, 0);
  await api('/api/moments', 'POST', { imageData: canvas.toDataURL('image/jpeg', 0.85), capturedBy: username });
  await loadMoments();
};

async function reactToMoment(id, emoji) {
  await api(`/api/moments/${id}/reaction`, 'POST', { reaction: emoji });
  await loadMoments();
}

async function commentOnMoment(id) {
  const text = prompt('Comment');
  if (!text) return;
  await api(`/api/moments/${id}/comment`, 'POST', { text });
  await loadMoments();
}

async function loadMoments() {
  const { moments } = await api('/api/moments');
  el.moments.innerHTML = '';
  moments.forEach((m) => {
    const div = document.createElement('div');
    div.className = 'moment';
    const reactionText = Object.entries(m.reactions || {}).map(([k, v]) => `${k} ${v}`).join(' ');
    const comments = (m.comments || []).map((c) => `<div><b>${c.author}</b>: ${c.text}</div>`).join('');
    div.innerHTML = `<div><b>${new Date(m.timestamp).toLocaleString()}</b> · ${m.capturedBy}</div>
      <img src="${m.imageData}" alt="moment" />
      <div>${reactionText || 'No reactions yet'}</div>
      <button data-react="❤️">❤️</button><button data-react="😂">😂</button>
      <button data-react="😍">😍</button><button data-react="🔥">🔥</button><button data-react="😴">😴</button>
      <button data-comment="1" class="secondary">Comment</button>
      <div>${comments}</div>`;
    div.querySelectorAll('[data-react]').forEach((btn) => (btn.onclick = () => reactToMoment(m.id, btn.dataset.react)));
    div.querySelector('[data-comment]').onclick = () => commentOnMoment(m.id);
    el.moments.appendChild(div);
  });
}

el.sendBtn.onclick = async () => {
  const text = el.chatInput.value.trim();
  if (!text) return;
  await sendEvent('chat-message', { text, username, clientId });
  el.chatInput.value = '';
};
el.chatInput.oninput = () => sendEvent('typing', { username, clientId });
document.querySelectorAll('.reactBtn').forEach((btn) => (btn.onclick = () => sendEvent('reaction', { emoji: btn.textContent, username })));
el.missYouBtn.onclick = () => sendEvent('miss-you', { username });
el.sendMoodBtn.onclick = () => sendEvent('mood', { value: el.moodSelect.value, username });

checkSession();
