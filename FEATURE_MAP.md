# LoveLink – Feature Map

## Project Vision

LoveLink is a **private, always-on live presence portal** between Agenor and Snooky.

Unlike traditional webcam software, LoveLink is designed as an **intimate shared digital space** rather than a surveillance or streaming tool.

The goal is to create a feeling of:

* connection
* presence
* playfulness
* shared memories

LoveLink runs on **Prime (Agenor’s desktop)** which acts as the permanent host server.

Snooky accesses the system through a **secure web interface**.

The system prioritizes:

* low latency
* emotional interaction
* shared moments
* simplicity

---

# System Identity

Host Node
Prime (Agenor's main desktop)

Primary User
Snooky

Viewer Count
1 primary viewer (Snooky)

Connection Type
WebRTC real-time streaming

Storage
Local storage on Prime

---

# Visual Identity

Default theme: **Pink**

Primary palette

Primary Pink: `#FF5FA2`
Soft Pink: `#FFD1E8`
Rose Accent: `#FF2F7D`
Background: `#FFF5FA`

Alternate themes

Lavender Dream
Midnight Mode
Cyber Pink
Soft Sunset

---

# Core Feature Pillars

LoveLink is built around four pillars.

1. **Presence**
2. **Moments**
3. **Interaction**
4. **Memories**

---

# V1 – Presence

The foundation of the system.

### Live Camera Stream

Features

* Logitech C920 video
* microphone audio
* WebRTC streaming
* low latency (~200-500ms)
* browser viewing

### Viewer Presence

The system shows when Snooky is watching.

Examples

"Snooky is watching ❤️"

"Snooky disconnected"

### Live Status Indicators

Snooky typing

Snooky reacting

Snooky screenshotting

---

# V1 – Moments

Shared capture of time.

### Screenshot Capture

Snooky can press:

📸 Capture Moment

System behavior

1. grabs video frame
2. saves locally
3. shows notification
4. adds to shared gallery

Notification examples

"Snooky captured a moment ❤️"

---

### Screenshot Gallery

A chronological timeline.

Each moment contains

* image
* timestamp
* who captured it
* reactions
* comments

Example

8:14 PM
Snooky captured this

[image]

❤️ 😍 😂

Comments
Snooky: you looked cute
Agenor: lol I was working

---

# V1 – Interaction

### Chat System

Simple real-time chat.

Used for short conversation while viewing.

Features

* live typing indicator
* message timestamps
* emoji reactions

---

### Reactions

Reactions can be applied to:

* screenshots
* messages

Supported reactions

❤️
😂
😍
🔥
😴

---

# V2 – Emotional Features

### Heartbeat Mode

When both users are connected:

A soft pulsing heart animation appears.

Symbolizes active presence.

---

### Miss You Button

Pressing sends a small animated heart.

Example notification

"Snooky sent you a ❤️"

Hearts float briefly across screen.

---

### Mood Reactions

Quick feelings:

Miss you
Watching you
Thinking of you
Laughing at you

---

# V3 – Memory System

### Automatic Moments

Optional auto capture.

Example:

capture frame every 10 minutes.

Creates daily timeline.

---

### Day Timeline

View an entire day of captured moments.

Morning
Afternoon
Evening

---

### Memory Highlights

Users can mark favorite moments.

---

# V4 – Communication Expansion

Optional features.

Voice return channel
Two-way video
Push notifications
Mobile viewing optimization

---

# V5 – Future Possibilities

Ambient music room
Shared playlist
Live drawing board
Remote light signals
Time capsule messages

---

# Architecture Overview


Prime (host PC)

Responsibilities

camera capture
microphone capture
WebRTC server
web server
database storage
file storage

Snooky Device

browser interface
WebRTC client
UI rendering

---

# Technology Stack (Initial)

Backend

Node.js
WebRTC
Socket.IO

Frontend

React
TailwindCSS

Storage

SQLite

Media

WebRTC
H264 video
Opus audio

---

# Security Model

Private access only.

Authentication options

password login

or

secure invite link

---

# Guiding Principles

LoveLink should always feel:

personal
simple
safe
warm
playful

Never corporate.

Never complicated.

Never generic.

---

# Long Term Philosophy

LoveLink is not just a webcam viewer.

It is a **shared digital window between two lives**.
