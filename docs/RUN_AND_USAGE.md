# LoveLink Run & Usage Guide

Last updated (UTC): 2026-03-06 02:54

This guide explains exactly how to run this build and how to use every major feature.

## 1) Requirements

- Node.js 18+.
- A modern browser (Chrome/Edge/Firefox recommended).
- Camera + microphone permissions on the host machine (Prime).

## 2) Start the app

From the repository root:

```bash
npm start
```

Expected startup log:

```text
LoveLink server running on http://localhost:3000
```

Then open:

- `http://localhost:3000`

## 3) Login

On the login card:

- **Display name**: choose your name (defaults to `Snooky`).
- **Password**: default is `lovelink`.
- Click **Enter LoveLink** (or press **Enter** in the display name/password field).

If you changed the password, use your `LOVE_LINK_PASSWORD` value.

## 4) Use the Presence roles (important)

After login, each connected browser chooses a role:

- **Host / Prime side**: click `I am Agenor (Host)`.
  - Browser asks for camera/mic permission.
  - Local preview appears.
- **Viewer / Snooky side**: click `I am Snooky (Viewer)`.
  - Remote video area appears.

When viewer is connected, status messages update:

- `Snooky is watching ❤️`
- `Snooky disconnected`

## 5) Core interaction features

### Chat

- Type in `Say something sweet...` and click **Send** (or press **Enter** in the message field).
- Messages appear with timestamps.
- Typing indicator appears live while the other person types.

### Reactions

- Click any reaction quick-button (`❤️ 😂 😍 🔥 😴`) in the Interaction panel.
- Reaction events are posted to the chat log.

### Miss You

- Click **Send ❤️**.
- A `Snooky sent you a ❤️` event appears and floating hearts animate briefly.

### Mood signals

- Pick a mood from the dropdown:
  - Miss you
  - Watching you
  - Thinking of you
  - Laughing at you
- Click **Send Mood**.

## 6) Moments & gallery

### Capture a moment

- Ensure a stream is active (host local stream or viewer remote stream).
- Click **📸 Capture Moment**.
- The current frame is captured and saved.

### View moments

- Scroll in the **Moments & Memories** panel.
- Each moment includes:
  - Timestamp
  - Capturer name
  - Image
  - Reactions
  - Comments

### React/comment on moments

- Click one of the emoji buttons under a moment to add a reaction count.
- Click **Comment** and enter text when prompted.

## 7) Configure runtime values

Use environment variables when starting:

```bash
PORT=4000 LOVE_LINK_PASSWORD='my-secret' SESSION_SECRET='strong-secret' npm start
```

## 8) Data persistence details

- App data is saved in `lovelink.json` at repository root.
- If you want a clean start, stop the server and delete this file.

## 9) Local network usage (optional)

To access from another device on your network:

1. Start app on Prime machine.
2. Find Prime LAN IP (e.g., `192.168.1.50`).
3. On Snooky device, browse `http://<prime-ip>:3000`.
4. Allow firewall access for Node.js/port 3000 if blocked.

## 10) Troubleshooting

### Cannot log in

- Verify password matches `LOVE_LINK_PASSWORD` (or default `lovelink`).

### Viewer sees no video

- Confirm host clicked `I am Agenor (Host)`.
- Confirm browser camera/mic permission is allowed.
- Check both browsers are connected and viewer clicked `I am Snooky (Viewer)`.

### Camera permission denied

- Re-enable camera/microphone permission in browser site settings.
- Refresh and click host role again.

### Port already in use

- Start on a different port:

```bash
PORT=3001 npm start
```

### Moments not saving

- Ensure app can write to repository directory.
- Check whether `lovelink.json` exists/updates after capture.

## 11) Operational checklist

Use this quick sequence each time:

1. `npm start`
2. Open URL in both host and viewer browsers.
3. Login in both tabs/devices.
4. Host clicks **I am Agenor (Host)**.
5. Viewer clicks **I am Snooky (Viewer)**.
6. Validate stream, then use chat/reactions/moments.
