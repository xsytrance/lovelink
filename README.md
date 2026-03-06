# LoveLink

Last updated (UTC): 2026-03-06 12:00

LoveLink is a private, always-on live presence portal for Agenor and Snooky.

This repository now includes a complete **run + usage guide** so you can start the app, log in, stream, and use moments/chat features quickly.

## What this build includes

- Password-protected private access.
- One-way host-to-viewer low-latency stream (WebRTC).
- Live presence status (`Snooky is watching ❤️` / `Snooky disconnected`).
- Live chat + typing indicators.
- Reactions (`❤️ 😂 😍 🔥 😴`).
- "Miss You" hearts + mood signals.
- Screenshot capture and chronological moments gallery.
- Moment reactions and comments.
- Local persistence in `lovelink.json`.
- Mobile-first single-screen layout with top video feed; feed stays compact while memories/comments scroll only when needed.
- Role selection on login (Host/Viewer) with immediate stream startup after login.
- Swipeable Feed ↔ Memories tabs and streamlined compact memory cards with delete actions.
- Android-friendly UI polish: floating animated emoji reactions, full custom emoji + stickers + GIF quick-send, hold-to-talk voice notes, synced mood backgrounds, equalizer overlays, and a customization panel.

## Quick Start

1. Make sure Node.js 18+ is installed.
2. From the project root, run:

```bash
npm start
```

3. Open `http://localhost:3000`.
4. Log in with password `lovelink` (unless overridden by env var).
5. Press **Enter** in login/message text fields if you prefer keyboard-only flow (login and chat send).

For full operational steps, role setup, and troubleshooting, see:

- [`docs/RUN_AND_USAGE.md`](docs/RUN_AND_USAGE.md)

## Environment variables

- `PORT` (default: `3000`) — server port.
- `LOVE_LINK_PASSWORD` (default: `lovelink`) — login password.
- `SESSION_SECRET` (default: `lovelink-secret`) — cookie signing secret.

## Scripts

```bash
npm start   # run the server
npm run dev # alias of start
npm run check # syntax check for server.js
```

## Storage

- Runtime moments are persisted to `lovelink.json` in repo root.
- `lovelink.json` is intentionally gitignored.

## Notes

- The app is dependency-free on purpose to run in restricted environments.
- Signaling and presence are implemented over Server-Sent Events + HTTP APIs.
