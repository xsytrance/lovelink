let username = 'Snooky';
let role = null;
let localStream = null;
let eventSource = null;
let openedMemory = null;
let activeTab = 0;
let mediaRecorder = null;
let voiceChunks = [];
let feedEnabled = true;
let audioEnabled = true;

const hostPeerConnections = new Map();
let viewerPeerConnection = null;

const THEMES = [
  { name: 'Pixel Pink', vars: { '--primary': '#ff4f98', '--primary-2': '#7d67ff', '--bg': '#f8f4ff', '--bg-2': '#fff8fc' } },
  { name: 'Mango Halo 🇵🇭', vars: { '--primary': '#fb8500', '--primary-2': '#1f4aa8', '--bg': '#fff8eb', '--bg-2': '#fffef8' } },
  { name: 'Liberty Pop 🇺🇸', vars: { '--primary': '#d7263d', '--primary-2': '#274690', '--bg': '#f6f8ff', '--bg-2': '#ffffff' } },
  { name: 'Mint Neon', vars: { '--primary': '#10b981', '--primary-2': '#2563eb', '--bg': '#f2fffb', '--bg-2': '#f8ffff' } },
  { name: 'Ube Night', vars: { '--primary': '#8b5cf6', '--primary-2': '#ec4899', '--bg': '#f5f2ff', '--bg-2': '#faf8ff' } }
];

const MOODS = {
  rose: { '--bg': '#fff4fb', '--bg-2': '#fffafd' },
  sunset: { '--bg': '#fff5ed', '--bg-2': '#fffdf8', '--primary': '#ff6f91', '--primary-2': '#ff9671' },
  ocean: { '--bg': '#edf6ff', '--bg-2': '#f8fcff', '--primary': '#3d8bfd', '--primary-2': '#5bc0eb' },
  midnight: { '--bg': '#f3f0ff', '--bg-2': '#faf8ff', '--primary': '#6f4ef6', '--primary-2': '#9c6dff' },
  mint: { '--bg': '#effff8', '--bg-2': '#f7fffc', '--primary': '#1fbf8f', '--primary-2': '#56d6c2' },
  gold: { '--bg': '#fff9e9', '--bg-2': '#fffef8', '--primary': '#f59e0b', '--primary-2': '#f97316' }
};

const STICKERS = ['🧸', '🌙', '💖', '✨', '🐼', '🎀', '🐣', '🍓', '🌸', '🥹'];
const GIFS = [
  'https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif',
  'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif',
  'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif',
  'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif'
];

const audioVisualizers = {
  host: { raf: null, audioCtx: null },
  viewer: { raf: null, audioCtx: null }
};

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
  hostEq: document.getElementById('hostEq'),
  viewerEq: document.getElementById('viewerEq'),
  captureBtn: document.getElementById('captureBtn'),
  heartBtn: document.getElementById('heartBtn'),
  gifMainBtn: document.getElementById('gifMainBtn'),
  toggleFeedBtn: document.getElementById('toggleFeedBtn'),
  toggleAudioBtn: document.getElementById('toggleAudioBtn'),
  themeQuickBtn: document.getElementById('themeQuickBtn'),
  heartEmojiInput: document.getElementById('heartEmojiInput'),
  moodSelect: document.getElementById('moodSelect'),
  moodApplyBtn: document.getElementById('moodApplyBtn'),
  moments: document.getElementById('moments'),
  chatLog: document.getElementById('chatLog'),
  chatInput: document.getElementById('chatInput'),
  sendBtn: document.getElementById('sendBtn'),
  typingIndicator: document.getElementById('typingIndicator'),
  missYouBtn: document.getElementById('missYouBtn'),
  holdTalkBtn: document.getElementById('holdTalkBtn'),
  memoryModal: document.getElementById('memoryModal'),
  memoryModalImage: document.getElementById('memoryModalImage'),
  memoryDetails: document.getElementById('memoryDetails'),
  memoryComments: document.getElementById('memoryComments'),
  memorySaveBtn: document.getElementById('memorySaveBtn'),
  memoryDeleteBtn: document.getElementById('memoryDeleteBtn'),
  memoryCloseBtn: document.getElementById('memoryCloseBtn'),
  swipeShell: document.getElementById('swipeShell'),
  swipeTrack: document.getElementById('swipeTrack'),
  feedTabBtn: document.getElementById('feedTabBtn'),
  memoriesTabBtn: document.getElementById('memoriesTabBtn'),
  customReactionInput: document.getElementById('customReactionInput'),
  customReactionBtn: document.getElementById('customReactionBtn'),
  stickerRow: document.getElementById('stickerRow'),
  gifRow: document.getElementById('gifRow'),
  customizeBtn: document.getElementById('customizeBtn'),
  customizePanel: document.getElementById('customizePanel'),
  themeSelect: document.getElementById('themeSelect'),
  compactToggle: document.getElementById('compactToggle'),
  glassToggle: document.getElementById('glassToggle')
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

function applyTheme(vars) {
  Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
}

function emojiBurst(emoji = '❤️') {
  for (let i = 0; i < 18; i += 1) {
    const node = document.createElement('div');
    node.className = 'float-emoji';
    node.textContent = emoji;
    node.style.left = `${Math.random() * 90 + 5}%`;
    node.style.bottom = `${Math.random() * 30 + 10}px`;
    node.style.animationDelay = `${Math.random() * 0.25}s`;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 1500);
  }
}

function setTab(index) {
  activeTab = index;
  el.swipeTrack.style.transform = `translateX(-${index * 50}%)`;
  el.feedTabBtn.classList.toggle('active', index === 0);
  el.memoriesTabBtn.classList.toggle('active', index === 1);
}

function appendChatNode(node, kind = 'system') {
  node.classList.add('chat-item', kind);
  el.chatLog.appendChild(node);
  const kids = [...el.chatLog.children];
  if (kids.length > 14) kids.slice(0, kids.length - 14).forEach((k) => k.remove());
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
}

function appendChatItem(text, kind = 'system') {
  const node = document.createElement('div');
  node.textContent = text;
  appendChatNode(node, kind);
}

function appendGifMessage(label, gifUrl, kind = 'viewer') {
  const node = document.createElement('div');
  node.innerHTML = `<div>${label}</div><img class="gif" src="${gifUrl}" alt="gif" loading="lazy" />`;
  appendChatNode(node, kind);
}

function appendVoiceMessage(label, audioData, kind = 'viewer') {
  const node = document.createElement('div');
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.src = audioData;
  node.append(label, audio);
  appendChatNode(node, kind);
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
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.82;
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);
  const draw = () => {
    analyser.getByteFrequencyData(data);
    const w = canvas.width;
    const h = canvas.height;
    const bars = data.length;
    const bw = w / bars;

    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, '#ffb7d8');
    grad.addColorStop(0.5, '#ff4f98');
    grad.addColorStop(1, '#7d67ff');
    ctx.fillStyle = grad;

    for (let i = 0; i < bars; i += 1) {
      const mag = data[i] / 255;
      const bh = Math.max(2, mag * (h - 4));
      ctx.fillRect(i * bw + 1, h - bh, Math.max(2, bw - 2), bh);
    }

    audioVisualizers[key].raf = requestAnimationFrame(draw);
  };
  draw();
}

function closeAllHostPeers() {
  hostPeerConnections.forEach((pc) => pc.close());
  hostPeerConnections.clear();
}

async function createHostPeerForViewer(viewerId) {
  if (!localStream) return;
  let pc = hostPeerConnections.get(viewerId);
  if (pc) return;

  pc = new RTCPeerConnection(iceConfig);
  hostPeerConnections.set(viewerId, pc);

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      await sendEvent('signal', { type: 'ice', candidate: event.candidate, from: clientId, to: viewerId });
    }
  };

  pc.onconnectionstatechange = async () => {
    if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
      pc.close();
      hostPeerConnections.delete(viewerId);
      if (pc.connectionState === 'failed' && localStream) {
        // attempt a lightweight renegotiation path for longer sessions
        await createHostPeerForViewer(viewerId);
      }
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await sendEvent('signal', { type: 'offer', offer, from: clientId, to: viewerId });
}

function ensureViewerPeer() {
  if (viewerPeerConnection) return viewerPeerConnection;
  viewerPeerConnection = new RTCPeerConnection(iceConfig);
  viewerPeerConnection.ontrack = (event) => {
    const [remoteStream] = event.streams;
    el.remoteVideo.srcObject = remoteStream;
    el.remoteVideo.classList.remove('hidden');
    setupEqualizer(el.viewerEq, remoteStream, 'viewer');
  };
  viewerPeerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      await sendEvent('signal', { type: 'ice', candidate: event.candidate, from: clientId });
    }
  };
  return viewerPeerConnection;
}

function setFeedEnabled(enabled) {
  feedEnabled = enabled;
  const activeVideo = role === 'host' ? el.localVideo : el.remoteVideo;
  if (activeVideo) activeVideo.style.opacity = enabled ? '1' : '0.25';
  if (role === 'host' && localStream) {
    localStream.getVideoTracks().forEach((t) => { t.enabled = enabled; });
  }
  el.toggleFeedBtn.textContent = enabled ? '📹' : '🚫';
}

function setAudioEnabled(enabled) {
  audioEnabled = enabled;
  if (role === 'host' && localStream) {
    localStream.getAudioTracks().forEach((t) => { t.enabled = enabled; });
  }
  if (role === 'viewer' && el.remoteVideo) {
    el.remoteVideo.muted = !enabled;
  }
  el.toggleAudioBtn.textContent = enabled ? '🔊' : '🔇';
}

function openMemoryModal(moment) {
  openedMemory = moment;
  el.memoryModalImage.src = moment.imageData;
  el.memoryDetails.textContent = `${new Date(moment.timestamp).toLocaleString()} · ${moment.capturedBy}`;
  el.memoryComments.innerHTML = '';
  const comments = moment.comments || [];
  if (!comments.length) {
    const c = document.createElement('div');
    c.className = 'memory-comment';
    c.textContent = 'No comments yet.';
    el.memoryComments.appendChild(c);
  } else {
    comments.forEach((comment) => {
      const c = document.createElement('div');
      c.className = 'memory-comment';
      c.innerHTML = `<b>${comment.author}</b>: ${comment.text}`;
      el.memoryComments.appendChild(c);
    });
  }
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

function initCustomization() {
  THEMES.forEach((theme, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = theme.name;
    el.themeSelect.appendChild(option);
  });
  el.themeSelect.onchange = () => applyTheme(THEMES[Number(el.themeSelect.value)].vars);
  el.compactToggle.onchange = () => document.documentElement.style.setProperty('--radius', el.compactToggle.checked ? '12px' : '18px');
  el.glassToggle.onchange = () => document.documentElement.style.setProperty('--surface', el.glassToggle.checked ? 'rgba(255,255,255,0.84)' : '#ffffff');
  el.customizeBtn.onclick = () => el.customizePanel.classList.toggle('hidden');
  document.addEventListener('click', (event) => {
    if (event.target === el.customizeBtn || el.customizeBtn.contains(event.target) || el.customizePanel.contains(event.target)) return;
    el.customizePanel.classList.add('hidden');
  });
}

function initStickersAndGifs() {
  el.stickerRow.innerHTML = '';
  STICKERS.forEach((sticker) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-soft';
    btn.textContent = sticker;
    btn.onclick = () => sendEvent('chat-message', { text: `Sticker ${sticker}`, username, clientId });
    el.stickerRow.appendChild(btn);
  });

  el.gifRow.innerHTML = '';
  GIFS.forEach((gifUrl, idx) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-soft';
    btn.textContent = `GIF ${idx + 1}`;
    btn.onclick = () => sendEvent('chat-message', { text: `GIF|${gifUrl}`, username, clientId });
    el.gifRow.appendChild(btn);
  });
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
  await sendEvent('set-role', { role, clientId });
  if (role === 'host') {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    el.localVideo.srcObject = localStream;
    el.localVideo.classList.remove('hidden');
    el.remoteVideo.classList.add('hidden');
    setupEqualizer(el.hostEq, localStream, 'host');
  } else {
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
    const header = `[${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ${who}: `;
    if (typeof text === 'string' && text.startsWith('GIF|')) {
      appendGifMessage(`${header}sent a GIF`, text.split('|')[1], kind);
      return;
    }
    appendChatItem(`${header}${text}`, kind);
  });

  on('voice-message', ({ username: who, audioData }) => {
    const kind = who === username ? 'host' : 'viewer';
    appendVoiceMessage(`${who} sent a voice note`, audioData, kind);
  });

  on('typing', ({ username: who, clientId: from }) => {
    if (from === clientId) return;
    el.typingIndicator.textContent = `${who} is typing...`;
    setTimeout(() => (el.typingIndicator.textContent = ''), 1000);
  });

  on('reaction', ({ emoji, username: who }) => {
    const kind = who === username ? 'host' : 'viewer';
    appendChatItem(`${who} reacted ${emoji}`, kind);
    emojiBurst(emoji || '✨');
  });

  on('miss-you', ({ message }) => {
    appendChatItem(message, 'system');
    emojiBurst(el.heartEmojiInput.value.trim() || '❤️');
  });

  on('mood', ({ value, username: who }) => {
    const kind = who === username ? 'host' : 'viewer';
    appendChatItem(`${who}: ${value}`, kind);
  });

  on('mood-theme', ({ mood }) => {
    if (MOODS[mood]) applyTheme({ ...THEMES[Number(el.themeSelect.value || 0)].vars, ...MOODS[mood] });
  });

  on('moment-captured', () => loadMoments());

  on('signal', async (data) => {
    if (data.to && data.to !== clientId) return;

    if (data.type === 'viewer-ready' && role === 'host' && localStream) {
      await createHostPeerForViewer(data.from || data.clientId);
      return;
    }

    if (data.type === 'offer' && role === 'viewer') {
      const pc = ensureViewerPeer();
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendEvent('signal', { type: 'answer', answer, from: clientId, to: data.from });
      return;
    }

    if (data.type === 'answer' && role === 'host') {
      const pc = hostPeerConnections.get(data.from);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      return;
    }

    if (data.type === 'ice') {
      if (role === 'host') {
        const pc = hostPeerConnections.get(data.from);
        if (pc && data.candidate) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else if (role === 'viewer') {
        const pc = ensureViewerPeer();
        if (pc && data.candidate) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
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

el.heartBtn.onclick = () => {
  const emoji = el.heartEmojiInput.value.trim() || '❤️';
  sendEvent('reaction', { emoji, username });
  emojiBurst(emoji);
};

el.gifMainBtn.onclick = () => {
  const gifUrl = GIFS[Math.floor(Math.random() * GIFS.length)];
  sendEvent('chat-message', { text: `GIF|${gifUrl}`, username, clientId });
};

el.toggleFeedBtn.onclick = () => setFeedEnabled(!feedEnabled);
el.toggleAudioBtn.onclick = () => setAudioEnabled(!audioEnabled);
el.themeQuickBtn.onclick = () => {
  const next = (Number(el.themeSelect.value || 0) + 1) % THEMES.length;
  el.themeSelect.value = String(next);
  applyTheme(THEMES[next].vars);
};

el.moodApplyBtn.onclick = () => {
  const mood = el.moodSelect.value;
  if (MOODS[mood]) applyTheme({ ...THEMES[Number(el.themeSelect.value || 0)].vars, ...MOODS[mood] });
  sendEvent('mood-theme', { mood, username });
  sendEvent('mood', { value: `set mood to ${mood}`, username });
};

async function reactToMoment(id, emoji) {
  if (!emoji) return;
  await api(`/api/moments/${id}/reaction`, 'POST', { reaction: emoji });
  await loadMoments();
  emojiBurst(emoji);
}

async function commentOnMoment(id, preset = '') {
  const text = preset || prompt('Comment or sticker');
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
    <div class="memory-thumb"><img src="${moment.imageData}" alt="memory" loading="lazy" /></div>
    <div class="memory-meta">${new Date(moment.timestamp).toLocaleDateString()} · ${moment.capturedBy}</div>
    <div class="memory-meta">${renderReactionSummary(moment.reactions)}</div>
    <div class="memory-actions">
      <button class="btn btn-soft" data-heart="1">❤️</button>
      <button class="btn btn-soft" data-comment="1">💬</button>
      <button class="btn btn-soft" data-sticker="1">🧸</button>
      <button class="btn btn-soft" data-save="1">Save</button>
      <button class="btn btn-danger" data-delete="1">Delete</button>
    </div>
    <div class="emoji-tools">
      <input class="field mem-emoji" placeholder="Any emoji 😀" />
      <button class="btn btn-soft" data-emoji-add="1">Add</button>
    </div>
  `;
  card.querySelector('img').onclick = () => openMemoryModal(moment);
  card.querySelector('[data-heart]').onclick = () => reactToMoment(moment.id, '❤️');
  card.querySelector('[data-comment]').onclick = () => commentOnMoment(moment.id);
  card.querySelector('[data-sticker]').onclick = () => commentOnMoment(moment.id, `Sticker ${STICKERS[Math.floor(Math.random() * STICKERS.length)]}`);
  card.querySelector('[data-save]').onclick = () => {
    openedMemory = moment;
    saveOpenedMemory();
  };
  card.querySelector('[data-delete]').onclick = () => deleteMemory(moment.id);
  card.querySelector('[data-emoji-add]').onclick = () => {
    const v = card.querySelector('.mem-emoji').value.trim();
    reactToMoment(moment.id, v);
  };
  return card;
}

async function loadMoments() {
  const { moments } = await api('/api/moments');
  el.moments.innerHTML = '';
  moments.slice(0, 8).forEach((moment) => el.moments.appendChild(createMomentCard(moment)));
}

async function handleSendMessage() {
  const text = el.chatInput.value.trim();
  if (!text) return;
  await sendEvent('chat-message', { text, username, clientId });
  el.chatInput.value = '';
}

async function startRecordingVoice() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => e.data.size && voiceChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(voiceChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = async () => {
        await sendEvent('voice-message', { username, audioData: reader.result });
        stream.getTracks().forEach((t) => t.stop());
      };
      reader.readAsDataURL(blob);
    };
    mediaRecorder.start();
    el.holdTalkBtn.classList.add('recording');
    el.holdTalkBtn.textContent = 'Recording... release to send';
  } catch {
    appendChatItem('Voice message unavailable here.', 'system');
  }
}

function stopRecordingVoice() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  mediaRecorder.stop();
  el.holdTalkBtn.classList.remove('recording');
  el.holdTalkBtn.textContent = 'Hold to Talk 🎤';
}

el.loginBtn.onclick = handleLogin;
el.sendBtn.onclick = handleSendMessage;
el.chatInput.onkeydown = (event) => {
  if (event.key === 'Enter') { event.preventDefault(); handleSendMessage(); }
};
[el.username, el.password].forEach((input) => {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); handleLogin(); }
  });
});
el.chatInput.oninput = () => sendEvent('typing', { username, clientId });

document.querySelectorAll('.reactBtn').forEach((btn) => {
  btn.onclick = () => {
    sendEvent('reaction', { emoji: btn.textContent, username });
    emojiBurst(btn.textContent);
  };
});

el.customReactionBtn.onclick = () => {
  const value = el.customReactionInput.value.trim();
  if (!value) return;
  sendEvent('reaction', { emoji: value, username });
  el.customReactionInput.value = '';
  emojiBurst(value);
};
el.customReactionInput.onkeydown = (event) => {
  if (event.key === 'Enter') { event.preventDefault(); el.customReactionBtn.click(); }
};

el.holdTalkBtn.addEventListener('pointerdown', startRecordingVoice);
el.holdTalkBtn.addEventListener('pointerup', stopRecordingVoice);
el.holdTalkBtn.addEventListener('pointercancel', stopRecordingVoice);
el.holdTalkBtn.addEventListener('pointerleave', (e) => { if (e.buttons === 1) stopRecordingVoice(); });

el.missYouBtn.onclick = () => {
  sendEvent('miss-you', { username });
  emojiBurst(el.heartEmojiInput.value.trim() || '❤️');
};
el.feedTabBtn.onclick = () => setTab(0);
el.memoriesTabBtn.onclick = () => setTab(1);

let touchStartX = 0;
el.swipeShell.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
el.swipeShell.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) < 35) return;
  if (dx < 0) setTab(1);
  if (dx > 0) setTab(0);
}, { passive: true });

el.memoryCloseBtn.onclick = closeMemoryModal;
el.memorySaveBtn.onclick = saveOpenedMemory;
el.memoryDeleteBtn.onclick = deleteOpenedMemory;
el.memoryModal.onclick = (event) => { if (event.target === el.memoryModal) closeMemoryModal(); };

setTab(0);
initCustomization();
initStickersAndGifs();
checkSession();
