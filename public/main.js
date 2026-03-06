let username = 'Snooky';
let role = null;
let localStream = null;
let peerConnection = null;
let eventSource = null;

function createClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
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
  sendMoodBtn: document.getElementById('sendMoodBtn'),
  hostEq: document.getElementById('hostEq'),
  viewerEq: document.getElementById('viewerEq')
};

const audioVisualizers = {
  host: { raf: null, audioCtx: null },
  viewer: { raf: null, audioCtx: null }
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

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function appendChatItem(text) {
  const item = document.createElement('div');
  item.className = 'chat-item';
  item.textContent = text;
  el.chatLog.appendChild(item);
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
}

function setupEqualizer(canvas, stream, key) {
  if (!canvas || !stream) return;

  if (audioVisualizers[key].raf) cancelAnimationFrame(audioVisualizers[key].raf);
  if (audioVisualizers[key].audioCtx) audioVisualizers[key].audioCtx.close().catch(() => {});

  const ctx = canvas.getContext('2d');
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  audioVisualizers[key].audioCtx = audioCtx;

  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 128;
  analyser.smoothingTimeConstant = 0.82;
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);

  const draw = () => {
    analyser.getByteFrequencyData(data);
    const width = canvas.width;
    const height = canvas.height;
    const bars = data.length;
    const barWidth = width / bars;

    ctx.clearRect(0, 0, width, height);
    const grad = ctx.createLinearGradient(0, height, 0, 0);
    grad.addColorStop(0, '#ffb7d8');
    grad.addColorStop(0.6, '#ff5fa2');
    grad.addColorStop(1, '#ff2f7d');
    ctx.fillStyle = grad;

    for (let i = 0; i < bars; i += 1) {
      const magnitude = data[i] / 255;
      const barHeight = Math.max(3, magnitude * (height - 10));
      const x = i * barWidth + 1;
      const y = height - barHeight;
      ctx.fillRect(x, y, Math.max(2, barWidth - 2), barHeight);
    }

    audioVisualizers[key].raf = requestAnimationFrame(draw);
  };

  draw();
}

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
    appendChatItem(message);
  });

  on('chat-message', ({ text, username: who, timestamp }) => {
    appendChatItem(`[${formatTime(timestamp)}] ${who}: ${text}`);
  });

  on('typing', ({ username: who, clientId: from }) => {
    if (from === clientId) return;
    el.typingIndicator.textContent = `${who} is typing...`;
    setTimeout(() => {
      el.typingIndicator.textContent = '';
    }, 1200);
  });

  on('reaction', ({ emoji, username: who }) => {
    appendChatItem(`${who} reacted ${emoji}`);
  });

  on('miss-you', ({ message }) => {
    appendChatItem(message);
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.textContent = '❤️';
    heart.style.left = `${Math.random() * 90 + 5}%`;
    heart.style.bottom = '20px';
    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 2000);
  });

  on('mood', ({ value, username: who }) => {
    appendChatItem(`${who}: ${value}`);
  });

  on('moment-captured', () => {
    appendChatItem('A new memory was captured 📸');
    loadMoments();
  });

  on('signal', async (data) => {
    if (data.to && data.to !== clientId) return;

    if (data.type === 'viewer-ready' && role === 'host' && localStream) {
      setupPeerConnection();
      localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
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

async function handleLogin() {
  try {
    username = el.username.value || 'Snooky';
    await api('/api/login', 'POST', { username, password: el.password.value });
    onAuthenticated();
  } catch (err) {
    el.loginError.textContent = err.message;
  }
}

el.loginBtn.onclick = handleLogin;

function setupPeerConnection() {
  peerConnection = new RTCPeerConnection(iceConfig);
  peerConnection.ontrack = (event) => {
    const [remoteStream] = event.streams;
    el.remoteVideo.srcObject = remoteStream;
    el.remoteVideo.classList.remove('hidden');
    setupEqualizer(el.viewerEq, remoteStream, 'viewer');
  };
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      await sendEvent('signal', { type: 'ice', candidate: event.candidate, from: clientId });
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

  setupEqualizer(el.hostEq, localStream, 'host');
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

  const maxWidth = 960;
  const maxHeight = 540;
  const ratio = Math.min(maxWidth / (sourceVideo.videoWidth || 640), maxHeight / (sourceVideo.videoHeight || 360), 1);

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor((sourceVideo.videoWidth || 640) * ratio);
  canvas.height = Math.floor((sourceVideo.videoHeight || 360) * ratio);
  canvas.getContext('2d').drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);

  await api('/api/moments', 'POST', { imageData: canvas.toDataURL('image/jpeg', 0.78), capturedBy: username });
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

function renderReactionSummary(reactions) {
  const entries = Object.entries(reactions || {});
  if (!entries.length) return 'No reactions yet';
  return entries.map(([emoji, count]) => `${emoji} ${count}`).join(' · ');
}

async function loadMoments() {
  const { moments } = await api('/api/moments');
  el.moments.innerHTML = '';

  moments.forEach((moment) => {
    const card = document.createElement('div');
    card.className = 'moment';

    const comments = (moment.comments || [])
      .map((comment) => `<div><b>${comment.author}</b>: ${comment.text}</div>`)
      .join('');

    card.innerHTML = `
      <div class="moment-head">
        <span>${new Date(moment.timestamp).toLocaleString()}</span>
        <span>${moment.capturedBy}</span>
      </div>
      <div class="moment-frame">
        <img src="${moment.imageData}" alt="Captured memory" loading="lazy" />
      </div>
      <div class="moment-comments">${renderReactionSummary(moment.reactions)}</div>
      <div class="moment-actions">
        <button class="btn btn-secondary" data-react="❤️">❤️</button>
        <button class="btn btn-secondary" data-react="😂">😂</button>
        <button class="btn btn-secondary" data-react="😍">😍</button>
        <button class="btn btn-secondary" data-react="🔥">🔥</button>
        <button class="btn btn-secondary" data-react="😴">😴</button>
        <button class="btn btn-secondary" data-comment="1">Comment</button>
      </div>
      <div class="moment-comments">${comments || ''}</div>
    `;

    card.querySelectorAll('[data-react]').forEach((btn) => {
      btn.onclick = () => reactToMoment(moment.id, btn.dataset.react);
    });
    card.querySelector('[data-comment]').onclick = () => commentOnMoment(moment.id);

    el.moments.appendChild(card);
  });
}

async function handleSendMessage() {
  const text = el.chatInput.value.trim();
  if (!text) return;
  await sendEvent('chat-message', { text, username, clientId });
  el.chatInput.value = '';
  el.chatInput.focus();
}

el.sendBtn.onclick = handleSendMessage;

el.chatInput.onkeydown = (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleSendMessage();
  }
};

[el.username, el.password].forEach((input) => {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleLogin();
    }
  });
});

el.chatInput.oninput = () => sendEvent('typing', { username, clientId });

document.querySelectorAll('.reactBtn').forEach((btn) => {
  btn.onclick = () => sendEvent('reaction', { emoji: btn.textContent, username });
});

el.missYouBtn.onclick = () => sendEvent('miss-you', { username });
el.sendMoodBtn.onclick = () => sendEvent('mood', { value: el.moodSelect.value, username });

checkSession();
