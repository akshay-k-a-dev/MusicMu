
# 🎵 MusicMu - Ad-Free Open Source Music Streamer

**A free and open-source music streaming application — built for music lovers, not algorithms.**

> ⚠️ **Not affiliated with or endorsed by Google LLC or YouTube.**  
> MusicMu streams content using official YouTube embedding policies and does not store or redistribute copyrighted material.

---

## ✨ What Makes MusicMu Special?

### 🎧 Core Playback Features
- 🚫 **Ad-Free Streaming** — Enjoy uninterrupted audio
- ⏭️ **Unlimited Skips** — Skip freely without restrictions
- 🔊 **Audio-Only Mode** — Save bandwidth, focus on sound
- 🎛️ **Full Playback Control** — Seek, play, pause, queue — without limitations
- 🔁 **Smart Queue** — Flexible queue with intuitive history navigation
- 👤 **Guest Mode Support** — No login required, your data stays on your device

### 🏗️ Modern UI/UX
- Stunning **glassmorphic design** powered by Tailwind CSS
- Delightful animations via Framer Motion
- Responsive, mobile-first layout
- Pages include:
  - **Home** – Main player
  - **Search** – Find any track
  - **Liked Songs**
  - **Queue Management**

---

## 🚀 Quick Deploy (Serverless)

> 🛠 Deployed and hosted on Vercel using serverless functions.

**Frontend:**  
🌐 https://music-mu-p6h9.vercel.app/  
React + Vite static site deployed on Vercel CDN

**Backend:**
🛠️ Fastify (Node.js) server running as Vercel Serverless Functions  
API Base: `https://music-mu-lovat.vercel.app/api`

**Directory:** `./vercel-serverless`

---

## 🧠 How It Works

### 🔍 Search & Metadata
- Powered by `Innertube` — an unofficial YouTube Data library (used for metadata and stream IDs)

### 📡 Stream Source
- All streaming uses **YouTube IFrame Player API**
  - No external audio URLs needed
  - Maximizes compatibility with YouTube ToS
  - Requires minimal backend processing

### 💾 Local Guest Storage
- Stored via IndexedDB using `localforage`
- Retains:
```

{
playlists,
liked songs,
recent queue,
last played track,
version
}

```
- Auto-clears after 30 days without a version match

---

## 📁 Project Structure Overview

```

musicmu/
├── vercel-serverless/       # Full serverless implementation for Vercel
│   ├── backend/             # API functions (Fastify)
│   │   ├── api/             # Serverless endpoints
│   │   ├── lib/             # YouTube + playback helpers
│   │   └── package.json
│   ├── frontend/            # React Vite app (client)
│   │   ├── src/             # Same as full-stack frontend
│   │   ├── public/          # PWA manifest, icons
│   │   └── package.json
│   ├── LICENSE              # GNU GPLv3 License
│   └── README.md
└── (legacy full-stack directories removed)

````

---

## 🔧 Key API Endpoints

> Base URL: `https://music-mu-lovat.vercel.app/api`

| Endpoint                         | Description             |
|----------------------------------|-------------------------|
| `GET /search?q=query`            | Search tracks           |
| `GET /track/:id`                 | Track metadata          |
| `GET /track/:id/stream`          | IFrame embed streaming  |
| `GET /guest/health`              | Guest mode health check |

---

## 🛠 Tech Stack

- **Frontend:**
  - React 18 + Vite
  - Zustand (State Management)
  - Tailwind CSS (UI)
  - Framer Motion (Animations)
  - Lucide React (Icons)

- **Backend:**
  - Fastify (Serverless optimized)
  - TypeScript
  - YouTube iFrame API (Streaming)
  - Innertube (Metadata search)

---

## 🔐 Environment Variables (Serverless)

Create `.env` files under `vercel-serverless/backend/` and `vercel-serverless/frontend/`.

### Backend `.env`:
```bash
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=*
````

### Frontend `.env`:

```bash
VITE_API_URL=https://music-mu-lovat.vercel.app/api
VITE_APP_NAME=MusicMu
VITE_APP_VERSION=1.0.0
```

---

## 👨‍💻 Developer

**Akshay K A**
📧 [akshayka@mamocollege.org](mailto:akshayka@mamocollege.org)
💻 Contributions welcome!

---

## 📜 License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**.
See the [`LICENSE`](./LICENSE) file for full details.

---

## ⏭️ What's Next?

We're building a full roadmap of what's coming next. Check it out here:
👉 *[MusicMu Roadmap](checklist.md)*

---

**Made with 💜 for listeners who want control, simplicity, and peace.**

