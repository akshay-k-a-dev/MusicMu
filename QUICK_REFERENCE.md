# 🗺️ MusicMu Quick Reference Guide

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                      MusicMu Stack                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FRONTEND          │        BACKEND        │   SERVICES    │
│  ─────────────     │    ──────────────     │   ──────────  │
│  React 18          │    Fastify/Node.js    │   YouTube     │
│  Vite Build        │    TypeScript         │   Innertube   │
│  Zustand State     │    PostgreSQL + ORM   │               │
│  Tailwind CSS      │    Prisma             │               │
│  IndexedDB Cache   │    JWT Auth           │               │
│  Framer Motion     │    CORS + Validation  │               │
│                    │                       │               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 Frontend Pages Quick Map

```
HOME SCREEN (/)
├─ Recently Played
├─ Most Played
├─ Top Artists
└─ Popular Tracks
   │
   ├─ Click Play → Goes to SEARCH to pick song
   │              or Plays from history
   │
   └─ Click Track → Full Details Page


MAIN NAVIGATION (All Screens)
├─ SEARCH (/search)
│  ├─ Enter query
│  ├─ Get results (1-10 min songs)
│  ├─ Play, Like, Add to Queue
│  └─ Load more results
│
├─ QUEUE (/queue)
│  ├─ View forward queue
│  ├─ View history (reverse queue)
│  └─ Reorder or skip
│
├─ LIKED (/liked)
│  ├─ All liked tracks
│  ├─ View only (no edit)
│  └─ Add to playlist
│
├─ PLAYLISTS (/playlists)
│  ├─ List of playlists
│  ├─ Click to view /playlist/:id
│  ├─ Edit tracks & order
│  └─ Create new
│
├─ BLENDS (/blends)
│  ├─ Collaborative playlists
│  ├─ Send invites to friends
│  └─ View shared /blends/:id
│
├─ PROFILE (/profile)
│  ├─ User info
│  ├─ Settings
│  └─ Logout
│
└─ LOGIN/REGISTER
   ├─ Create account (/register)
   └─ Sign in (/login)
```

---

## 🔧 Backend Routes Quick Reference

### Public Routes (No Auth)
```
GET  /api/health                    ✓ Service health
GET  /api/search?q=song             ✓ Search YouTube
GET  /api/track/{id}                ✓ Get track info
GET  /api/track/{id}/stream         ✓ Get IFrame URL
GET  /api/guest                     ✓ Create guest session
```

### Protected Routes (Require JWT)
```
AUTH:           /api/auth/register, /login, /me

LIKES:          /api/likes
                GET    (list all)
                POST   (like track)
                DELETE /{trackId} (unlike)
                GET    /{trackId} (check if liked)

PLAYLISTS:      /api/playlists
                GET    (list)
                POST   (create)
                GET    /{id} (view + tracks)
                POST   /{id}/tracks (add)
                DELETE /{id}/tracks/{trackId} (remove)
                GET    /discover/popular (trending)

HISTORY:        /api/history
                GET    (paginated plays)
                POST   (record play)

RECOMMENDATIONS: /api/recommendations
                 GET    (personalized)

BLENDS:         /api/blends
                POST   /invite (send invite)
                GET    /invites (receive)
                POST   /invites/{id}/accept
                POST   /invites/{id}/reject
                GET    (list my blends)
                GET    /{id} (view blend)
                POST   /{id}/tracks (add)
```

---

## 💾 Database Models at a Glance

### Entity Relationship Diagram (ERD)

```
┌────────────────────────────────────────────────────────────────┐
│              MusicMu Database Structure (10 Tables)             │
└────────────────────────────────────────────────────────────────┘

                          USERS (Core Hub)
                    ┌──────┬──────┬──────┬──────┬──────┬──────┐
                    │      │      │      │      │      │      │
              1→N   │ 1→N  │ 1→N  │ 1→N  │ 1→N  │ 1→N  │ 1→N
                    │      │      │      │      │      │      │
            ┌───────┴──┐   │      │      │      │      │      │
            │          ▼   ▼      ▼      ▼      ▼      ▼      ▼
        PLAYLISTS  PLAY_  LIKED_  RECOM-  BLEND-  BLENDS
                   HISTORY TRACKS MENDS   INVITES
            │
          1→N
            │
            ▼
        PLAYLIST_
        TRACKS


        BLENDS (Collaborative)
          │
          ├─ 1→1 (Unique) ──→ PLAYLISTS (shared playlist)
          │
          └─ 1→N ────────→ BLEND_TRACKS


STANDALONE TABLES (Performance Caches):
  • CACHED_POPULAR_TRACKS (no FK)
  • SYSTEM_CACHE (no FK)
```

### Table Relationships (Quick Reference)

```
USERS
  └─ 1→N PLAYLISTS (user's playlists)
       └─ 1→N PLAYLIST_TRACKS (songs in playlist)
  │
  ├─ 1→N PLAY_HISTORY (listening record)
  ├─ 1→N LIKED_TRACKS (user's favorites)
  ├─ 1→N RECOMMENDATIONS (personalization)
  │
  └─ 1→N BLEND_INVITES
       ├─ as SENDER (invites sent)
       └─ as RECEIVER (invites received)
           ├─ ACCEPT → Creates BLENDS
           └─ Each BLEND has:
              ├─ 1→N BLEND_TRACKS (collaborative songs)
              └─ 1→1 PLAYLISTS (shared playlist via FK)
```

### Models Overview

```
USER
├─ id, email (unique), username (unique)
├─ password (hashed), name, avatar
└─ Relations: 7 outgoing

LIKED_TRACK
├─ userId, trackId (unique per user)
├─ title, artist, thumbnail, duration
└─ likedAt: DateTime

PLAYLIST
├─ userId, name, description
├─ isPublic: Boolean (private by default)
└─ tracks: PlaylistTrack[]

PLAYLIST_TRACK
├─ playlistId, trackId (unique per playlist)
├─ title, artist, position (order)
└─ addedAt: DateTime

PLAY_HISTORY
├─ userId, trackId
├─ title, artist, thumbnail
└─ playedAt: DateTime

RECOMMENDATION
├─ userId, trackId (unique)
├─ source: "play" | "search" | "like"
├─ score: Float (for ranking)
├─ playCount, lastPlayedAt
└─ isLiked, likedAt

BLEND_INVITE
├─ senderId, receiverId (unique pair)
├─ status: "pending" | "accepted" | "rejected"
└─ respondedAt: DateTime

BLEND
├─ id (unique: user1Id + user2Id)
├─ name, user1Id, user2Id
├─ playlistId (associated playlist)
└─ tracks: BlendTrack[]

BLEND_TRACK
├─ blendId, trackId (unique)
├─ title, artist, sourceUserId (who added)
└─ position: Int (order)

CACHED_POPULAR_TRACKS (for performance)
├─ trackId (unique)
├─ title, artist, thumbnail, duration
└─ playlistCount: Int (popularity)

SYSTEM_CACHE (for cron jobs)
├─ key: String (unique)
└─ value: String (JSON)

---

## 🎯 Common User Flows

### 1️⃣ First Time User (Guest)
```
Visit App
  ↓
Search "Imagine"
  ↓
See results
  ↓
Click play on first result
  ↓
YouTube IFrame loads
  ↓
Music plays!
  ↓
Can like, add to queue
  ↓
Data saved to IndexedDB (local only)
  ↓
Can close app, come back, data persists
```

### 2️⃣ Create Account & Login
```
Click "Sign Up" (/register)
  ↓
Enter email + password
  ↓
Backend: Hash password, create user
  ↓
Get JWT token
  ↓
Save to IndexedDB
  ↓
Redirect to home
  ↓
Now: Likes sync to database!
  ↓
Can access from any device
```

### 3️⃣ Blend with Friend
```
User A clicks "Create Blend"
  ↓
Enters Friend B's email
  ↓
POST /api/blends/invite
  ↓
Friend B gets notification
  ↓
Friend B clicks "Accept"
  ↓
Blend created, shared playlist made
  ↓
Both can add songs to blend
  ↓
Songs tagged with "Added by A" or "Added by B"
```

### 4️⃣ Personalized Recommendations (Auth)
```
User logs in
  ↓
Sync plays from database
  ↓
Home page: GET /api/recommendations
  ↓
Backend aggregates:
  ├─ Recent tracks (last 10 unique)
  ├─ Most played (by count)
  └─ Top artists (grouped)
  ↓
Display recommendations
  ↓
As user plays more:
  ├─ Database updated
  └─ Next load: refined recommendations
```

---

## 🔐 Authentication Pattern

```
LOGIN FORM
  ↓
POST /api/auth/login
  ├─ Input: { email, password }
  ├─ Backend: Verify credentials
  └─ Output: { user, token }
  ↓
FRONTEND: useAuth.setAuth(token, user)
  ├─ Save to IndexedDB
  ├─ Set Zustand state
  └─ Add to Authorization header
  ↓
FUTURE API CALLS:
  ├─ Header: Authorization: Bearer {token}
  ├─ Fastify verifies JWT
  └─ request.user populated
  ↓
PROTECTED ROUTE EXAMPLE:
  fastify.get('/likes', {
    onRequest: [fastify.authenticate]  // Check token
  }, async (request, reply) => {
    const userId = request.user.id;    // Extract from JWT
    const likes = await db.find({ userId });
    return { likes };
  });
```

---

## 📊 State Management (Zustand)

```
USEAUTH STORE (Authentication)
├─ token: string
├─ user: User object
├─ isAuthenticated: boolean
├─ setAuth(token, user)
├─ logout()
└─ initAuth() (load from IndexedDB)

USEPLAYER STORE (Playback)
├─ state: "playing" | "paused" | "idle"
├─ currentTrack: Track
├─ queue: Track[]
├─ volume: number
├─ progress: number
├─ play(track)
├─ next()
├─ prev()
├─ togglePlay()
├─ seek(seconds)
├─ addToQueue(track)
└─ like/unlike(track)

USEBLEND STORE (Collaborative)
├─ blends: Blend[]
├─ invites: BlendInvite[]
├─ fetchBlends()
├─ sendInvite(email)
├─ acceptInvite(id)
└─ rejectInvite(id)

CACHE (IndexedDB via localforage)
├─ Guest playlists
├─ Guest likes
├─ Queue history
├─ Discovered tracks
└─ Lyrics (by artist-title)
```

---

## 🎬 Playback Architecture

```
PLAY TRACK
  ↓
Load YouTube IFrame Player API
  ↓
Create player instance
  ↓
player.loadVideoById(videoId)
  ↓
YOUTUBE HANDLES:
├─ Authentication (region, availability)
├─ Quality selection
├─ Ad serving (if applicable)
├─ DRM/Copyright
└─ Audio stream
  ↓
OUR CODE HANDLES:
├─ UI/Controls (play, pause, seek)
├─ Queue management
├─ Progress tracking
├─ History recording
└─ State management
```

---

## 📈 Performance Optimization

```
FRONTEND:
├─ Zustand caching (avoid re-renders)
├─ IndexedDB for offline
├─ Lazy-load images (thumbnails)
└─ Code-split pages (Vite)

BACKEND:
├─ Prisma caching (60s TTL, 30s SWR)
├─ Database indexes on:
│  ├─ userId (user lookups)
│  ├─ trackId (popularity)
│  └─ status (invites)
├─ Popular tracks cache (pre-computed)
└─ Aggregation queries optimized

DATABASE:
├─ Proper foreign keys & constraints
├─ Cascade deletes (no orphans)
├─ Unique constraints (no dupes)
└─ Audit fields (timestamps)
```

---

## 🚀 Deployment Checklist

### Frontend (Vercel)
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] `.env.production` has `VITE_API_URL`
- [ ] Push to Git
- [ ] Vercel auto-deploys

### Backend (Vercel)
- [ ] Environment variables set:
  - [ ] DATABASE_URL (PostgreSQL)
  - [ ] JWT_SECRET
  - [ ] CORS_ORIGIN
- [ ] `npx prisma migrate deploy` run
- [ ] TypeScript compiles
- [ ] Push to Git
- [ ] Vercel auto-deploys functions

### Database (PostgreSQL)
- [ ] Create Postgres instance
- [ ] Run migrations: `prisma migrate deploy`
- [ ] Set DATABASE_URL in backend env
- [ ] Verify connection works

---

## 🐛 Debugging Quick Tips

| Issue | Check |
|-------|-------|
| "Not authenticated" | Is token in IndexedDB? Is JWT expired? |
| "Video not playing" | Is video available in your region? Try different result. |
| "Playlist not saving" | Are you authenticated? Check browser console for errors. |
| "Search returns nothing" | Is query 1-10 minutes? Try different keyword. |
| "Blend invite missing" | Refresh page. Check notification component. Poll interval OK? |
| "IndexedDB full" | Clear cache or login to move to cloud. |

---

## 🔗 Important Links

| Resource | URL |
|----------|-----|
| Live App | https://music-mu-p6h9.vercel.app/ |
| Backend API | https://music-mu-lovat.vercel.app/api |
| API Health | https://music-mu-lovat.vercel.app/api/health |
| GitHub | (your repo URL) |
| Issues | (your issues page) |

---

## 📚 Documentation Index

1. **README.md** - Project overview & quick start
2. **PROJECT_DOCUMENTATION.md** - Complete technical docs
3. **DOCUMENTATION_SUMMARY.md** - What was documented
4. **QUICK_REFERENCE.md** - This file!

---

## 💡 Tips for Developers

### Adding a New Feature
1. **Database First**: Design schema in `prisma/schema.prisma`
2. **Run Migration**: `npx prisma migrate dev --name feature_name`
3. **Backend Route**: Add endpoint in `src/routes/`
4. **Frontend Store**: Add Zustand action if needed
5. **UI Component**: Create React component
6. **Test**: Manual testing + error handling

### Working with Blends
- Always check user is participant before returning data
- Create BlendTrack with sourceUserId to track who added
- Position field orders tracks (incrementing)
- One blend per user pair (unique constraint)

### Working with Recommendations
- Only for authenticated users
- Aggregates from PlayHistory
- Used for home page personalization
- Deduplicate by trackId (recently played)

### Working with Queue
- Forward queue: songs coming up
- Reverse queue: stack of songs played (history)
- Current track: currently playing
- Move to reverse on play() or next()
- Pop from reverse on prev()

---

## 🎓 Learning Path

**For New Developers:**
1. Read README.md (2 min)
2. Review Architecture diagram (2 min)
3. Pick 1 page (5 min read)
4. Read its data flow diagram (3 min)
5. Review backend route for that feature (5 min)
6. Check database schema (2 min)
7. Try making small change (bug fix, UI tweak)

**For Feature Implementation:**
1. Design in database schema first
2. Create backend route
3. Create Zustand store action
4. Create UI component
5. Test flow end-to-end

---

**Quick Reference v1.0.0** | Last Updated: Jan 17, 2026
