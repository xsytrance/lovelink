let username = 'Snooky';
let role = null;
let localStream = null;
let peerConnection = null;
let eventSource = null;
let openedMemory = null;
let activeTab = 0;

function createClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

const clientId = createClientId();
const iceConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const el = {
  loginCard: document.getElementById('loginCard'),
  appRoot: document.getElementById('appRoot'),
  username: document.getElementById('username'),
  password: document.getElementById('password'),
  roleSelect: document.getElementById('roleSelect'),
  loginBtn: document.getElementById('loginBtn'),
  loginError: document.getElementById('loginError'),
  presence: document.getElementById('presence'),
  localVideo: document.getElementById('localVideo'),
  remoteVideo: document.getElementById('remoteVideo'),
  captureBtn: document.getElementById('captureBtn'),
  moments: document.getElementById('moments'),
  chatLog: document.getElementById('chatLog'),
  chatInput: document.getElementById('chatInput'),
  sendBtn: document.getElementById('sendBtn'),
  typingIndicator: document.getElementById('typingIndicator'),
  missYouBtn: document.getElementById('missYouBtn'),
  memoryModal: document.getElementById('memoryModal'),
  memoryModalImage: document.getElementById('memoryModalImage'),
  memorySaveBtn: document.getElementById('memorySaveBtn'),
  memoryDeleteBtn: document.getElementById('memoryDeleteBtn'),
  memoryCloseBtn: document.getElementById('memoryCloseBtn'),
  swipeShell: document.getElementById('swipeShell'),
  swipeTrack: document.getElementById('swipeTrack'),
  feedTabBtn: document.getElementById('feedTabBtn'),
  memoriesTabBtn: document.getElementById('memoriesTabBtn')
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

function setTab(index) {
  activeTab = index;
  el.swipeTrack.style.transform = `translateX(-${index * 50}%)`;
  el.feedTabBtn.classList.toggle('active', index === 0);
  el.memoriesTabBtn.classList.toggle('active', index === 1);
}

function appendChatItem(text, kind = 'system') {
  const item = document.createElement('div');
  item.className = `chat-item ${kind}`;
  item.textContent = text;
  el.chatLog.appendChild(item);

  const kids = [...el.chatLog.children];
  if (kids.length > 7) kids.slice(0, kids.length - 7).forEach((k) => k.remove());
}

function openMemoryModal(moment) {
  openedMemory = moment;
  el.memoryModalImage.src = moment.imageData;
  el.memoryModal.classList.remove('hidden');
}

function closeMemoryModal() {
  openedMemory = null;
  el.memoryModal.classList.add('hidden');
  el.memoryModalImage.removeAttribute('src');
}

function saveOpenedMemory() {
  if (!openedMemory) return;
  const link = document.createElement('a');
  link.href = openedMemory.imageData;
  link.download = `lovelink-memory-${openedMemory.id}.jpg`;
  link.click();
}

async function deleteMemory(id) {
  await api(`/api/moments/${id}`, 'DELETE');
  await loadMoments();
}

async function deleteOpenedMemory() {
  if (!openedMemory) return;
  await deleteMemory(openedMemory.id);
  closeMemoryModal();
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

async function startSelectedRole() {
  if (role === 'host') {
    await sendEvent('set-role', { role, clientId });
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    el.localVideo.srcObject = localStream;
    el.localVideo.classList.remove('hidden');
    el.remoteVideo.classList.add('hidden');
  } else {
    await sendEvent('set-role', { role, clientId });
    el.localVideo.classList.add('hidden');
    el.remoteVideo.classList.remove('hidden');
  }
}

function connectEvents() {
  eventSource = new EventSource('/events');
  const on = (name, fn) => eventSource.addEventListener(name, (e) => fn(JSON.parse(e.data)));

  on('presence', ({ hostConnected, viewerConnected, viewersOnline }) => {
    el.presence.textContent = `H:${hostConnected ? '●' : '○'} V:${viewerConnected ? '●' : '○'} · ${viewersOnline}`;
  });

  on('viewer-status', ({ message }) => appendChatItem(message, 'system'));

  on('chat-message', ({ text, username: who, timestamp }) => {
    const kind = who === username ? 'host' : 'viewer';
    appendChatItem(`[${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ${who}: ${text}`, kind);
  });

  on('typing', ({ username: who, clientId: from }) => {
    if (from === clientId) return;
    el.typingIndicator.textContent = `${who} is typing...`;
    setTimeout(() => { el.typingIndicator.textContent = ''; }, 1000);
  });

  on('reaction', ({ emoji, username: who }) => {
    const kind = who === username ? 'host' : 'viewer';
    appendChatItem(`${who} reacted ${emoji}`, kind);
  });

  on('miss-you', ({ message }) => appendChatItem(message, 'system'));

  on('mood', ({ value, username: who }) => {
    const kind = who === username ? 'host' : 'viewer';
    appendChatItem(`${who}: ${value}`, kind);
  });

  on('moment-captured', () => loadMoments());

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
    role = el.roleSelect.value;
    await api('/api/login', 'POST', { username, password: el.password.value });
    onAuthenticated();
    await startSelectedRole();
  } catch (err) {
    el.loginError.textContent = err.message;
  }
}

function setupPeerConnection() {
  peerConnection = new RTCPeerConnection(iceConfig);
  peerConnection.ontrack = (event) => {
    const [remoteStream] = event.streams;
    el.remoteVideo.srcObject = remoteStream;
    el.remoteVideo.classList.remove('hidden');
  };
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      await sendEvent('signal', { type: 'ice', candidate: event.candidate, from: clientId });
    }
  };
}

el.captureBtn.onclick = async () => {
  const sourceVideo = role === 'host' ? el.localVideo : el.remoteVideo;
  if (!sourceVideo.srcObject) return;

  const maxWidth = 640;
  const maxHeight = 360;
  const ratio = Math.min(maxWidth / (sourceVideo.videoWidth || 640), maxHeight / (sourceVideo.videoHeight || 360), 1);

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor((sourceVideo.videoWidth || 640) * ratio);
  canvas.height = Math.floor((sourceVideo.videoHeight || 360) * ratio);
  canvas.getContext('2d').drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);

  await api('/api/moments', 'POST', { imageData: canvas.toDataURL('image/jpeg', 0.74), capturedBy: username });
  await loadMoments();
  setTab(1);
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
  if (!entries.length) return 'No reactions';
  return entries.map(([emoji, count]) => `${emoji}${count}`).join(' · ');
}

function createMomentCard(moment) {
  const card = document.createElement('div');
  card.className = 'memory-card';

  card.innerHTML = `
    <div class="memory-thumb">
      <img src="${moment.imageData}" alt="memory" loading="lazy" />
    </div>
    <div class="memory-meta">${new Date(moment.timestamp).toLocaleDateString()} · ${moment.capturedBy}</div>
    <div class="memory-meta">${renderReactionSummary(moment.reactions)}</div>
    <div class="memory-mini-actions">
      <button class="btn btn-soft" data-react="❤️">❤️</button>
      <button class="btn btn-soft" data-comment="1">💬</button>
      <button class="btn btn-danger" data-delete="1">Delete</button>
    </div>
  `;

  card.querySelector('img').onclick = () => openMemoryModal(moment);
  card.querySelector('[data-react]').onclick = () => reactToMoment(moment.id, '❤️');
  card.querySelector('[data-comment]').onclick = () => commentOnMoment(moment.id);
  card.querySelector('[data-delete]').onclick = () => deleteMemory(moment.id);

  return card;
}

async function loadMoments() {
  const { moments } = await api('/api/moments');
  el.moments.innerHTML = '';
  moments.slice(0, 6).forEach((moment) => el.moments.appendChild(createMomentCard(moment)));
}

async function handleSendMessage() {
  const text = el.chatInput.value.trim();
  if (!text) return;
  await sendEvent('chat-message', { text, username, clientId });
  el.chatInput.value = '';
}

el.loginBtn.onclick = handleLogin;
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

el.feedTabBtn.onclick = () => setTab(0);
el.memoriesTabBtn.onclick = () => setTab(1);

let touchStartX = 0;
el.swipeShell.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].clientX;
}, { passive: true });

el.swipeShell.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) < 35) return;
  if (dx < 0) setTab(1);
  if (dx > 0) setTab(0);
}, { passive: true });

el.memoryCloseBtn.onclick = closeMemoryModal;
el.memorySaveBtn.onclick = saveOpenedMemory;
el.memoryDeleteBtn.onclick = deleteOpenedMemory;
el.memoryModal.onclick = (event) => {
  if (event.target === el.memoryModal) closeMemoryModal();
};

setTab(0);
checkSession();
