# 📋 MusicMu Project Documentation

## Complete Architecture & Feature Guide

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Database Schema](#database-schema)
3. [Frontend Pages & Features](#frontend-pages--features)
4. [Backend Routes & Logic](#backend-routes--logic)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Authentication Flow](#authentication-flow)
7. [Caching & Performance](#caching--performance)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MusicMu Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐                  ┌─────────────────┐  │
│  │   React 18 SPA   │                  │  Fastify API    │  │
│  │   + Vite Build   │                  │  (Serverless)   │  │
│  │  + Zustand       │                  │                 │  │
│  │                  │─────────JWT──────│  PostgreSQL     │  │
│  │  (Frontend)      │    + JSON        │  (Prisma ORM)   │  │
│  └──────────────────┘                  └─────────────────┘  │
│         │                                      │              │
│         │ localStorage                         │              │
│         └─────────────┬──────────────────────┬─┘              │
│                       │                      │                │
│               ┌───────▼────────┐   ┌────────▼────────┐       │
│               │   IndexedDB    │   │  YouTube IFrame │       │
│               │  (Guest/Cache) │   │  Player API     │       │
│               └────────────────┘   └─────────────────┘       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### Frontend (React + Vite)
- **State Management**: Zustand (lightweight alternative to Redux)
- **Routing**: React Router v6
- **Styling**: Tailwind CSS + custom animations
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Local Storage**: localforage (IndexedDB wrapper)
- **Build Tool**: Vite (fast dev + production builds)

#### Backend (Fastify Serverless)
- **Runtime**: Node.js on Vercel
- **Framework**: Fastify (optimized for serverless)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (signed with secret)
- **Search**: Innertube (YouTube metadata library)
- **Streaming**: YouTube IFrame API only (no audio files stored)

#### Playback System
- **Mode**: IFrame-only (official YouTube embedding)
- **No Direct Audio**: All audio streams through YouTube
- **Queue Management**: Dual-queue architecture (forward + history)
- **Wake Lock**: Screen wake lock for background playback

---

## Database Schema

### Complete Relationship Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    MusicMu Database Graph                        │
│                  (10 Models, Fully Relational)                   │
└─────────────────────────────────────────────────────────────────┘

                            users (Core)
                              │ │ │ │ │ │ │
        ┌─────────────────────┼─┼─┼─┼─┼─┼─┴────────────────────┐
        │                     │ │ │ │ │ │  (7 relationships)   │
        │                     │ │ │ │ │ │                       │
        ▼                     ▼ ▼ ▼ ▼ ▼ ▼                       ▼
    playlists          play_history liked_tracks         blend_invites
        │                   │          │                   (2 FK: send/rcv)
        │                   │          │                      │
        └─────────────┬─────┴──────────┴─────────────────────┤
                      │                                       │
                      ▼                                       ▼
            playlist_tracks                             blends
                                                          │  │
                                                ┌─────────┘  └─────────┐
                                                │                      │
                                                ▼                      ▼
                                          blend_tracks          (1:1) playlists
                                          (blend content)       (shared playlist)

                          recommendations (user-specific)
```

### 1. Core User Relationships

**`users` Table**

Primary entity managing all user data and owning 7 distinct relationships.

```
users {
  id: String (CUID) - Primary Key
  email: String (Unique)
  username: String (Unique) - Auto-generated from email if not provided
  password: String (Hashed with bcryptjs)
  name: String (Optional)
  avatar: String URL (Optional)
  createdAt: DateTime
  updatedAt: DateTime
  
  Relations (1 → N):
  ├─ 1 user → N playlists (user-created playlists)
  ├─ 1 user → N play_history (listening history)
  ├─ 1 user → N liked_tracks (favorite tracks)
  ├─ 1 user → N recommendations (personalization data)
  ├─ 1 user → N blend_invites (SENT - as sender)
  ├─ 1 user → N blend_invites (RECEIVED - as receiver)
  └─ 1 user → N blends (collaborative playlists)
}

Relational Intent:
- User is the central entity
- All other tables reference users.id
- Self-referencing via blend_invites (senderId & receiverId)
- Cascade delete: If user deleted, all their data deleted
```

### User Model (Prisma Schema)

```typescript
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  username  String   @unique
  password  String
  name      String?
  avatar    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // All relations (7 total)
  likedTracks          LikedTrack[]
  playlists            Playlist[]
  playHistory          PlayHistory[]
  recommendations      Recommendation[]
  blendInvitesSent     BlendInvite[]    @relation("InviteSender")
  blendInvitesReceived BlendInvite[]    @relation("InviteReceiver")
  blends               Blend[]          @relation("BlendUser1")
  blendsAsUser2        Blend[]          @relation("BlendUser2")
  
  @@index([email])
  @@index([username])
  @@map("users")
}
```

---

### 2. Playlist System

**Hierarchy:** `users` → `playlists` → `playlist_tracks`

```
Playlist Relationship Structure:

users (owner)
  │
  └─→ playlists (1-N)
       │
       └─→ playlist_tracks (1-N)
            │
            ├─ trackId (YouTube ID - denormalized)
            ├─ title, artist (metadata cache)
            └─ position (ordering)
```

#### `playlists` Table

```
Playlist {
  id: String (CUID) - Primary Key
  userId: String (FK → users.id)
  name: String
  description: String (Optional)
  thumbnail: String URL (Optional)
  isPublic: Boolean (default: false)
  createdAt: DateTime
  updatedAt: DateTime
  
  Relations:
  ├─ user: User (FK)
  ├─ tracks: PlaylistTrack[] (1 → N)
  └─ blend: Blend? (1 → 0..1, optional - if part of blend)
  
  Constraints:
  ├─ [userId] indexed for fast lookup
  └─ Cascade delete: If user deleted, playlists deleted
}
```

#### `playlist_tracks` Table

```
PlaylistTrack {
  id: String (CUID) - Primary Key
  playlistId: String (FK → playlists.id)
  trackId: String (YouTube Video ID - denormalized, no FK)
  title: String (denormalized cache)
  artist: String (denormalized cache)
  thumbnail: String URL (Optional, cache)
  duration: Int (seconds, Optional, cache)
  position: Int (ordering within playlist)
  addedAt: DateTime
  
  Relations:
  └─ playlist: Playlist (FK)
  
  Constraints:
  ├─ UNIQUE[playlistId, trackId] - No duplicate tracks per playlist
  ├─ [playlistId] indexed for track retrieval
  └─ Cascade delete: If playlist deleted, tracks deleted
  
  Design Pattern:
  - Tracks are DENORMALIZED (no separate tracks table)
  - YouTube Video IDs used directly (no trackId FK)
  - Metadata cached (title, artist, duration)
  - Position field for custom ordering
}
```

---

### 3. Blends (Collaborative Playlists)

**Hierarchy:** `blend_invites` → `blends` → `blend_tracks` (+ shared `playlists`)

```
Blend Relationship Structure:

blend_invites                 blends                   playlists
(user A → user B)               │                     (shared via
  │                             │                      playlistId FK)
  └─→ ACCEPT                    ├─→ blend_tracks
      ↓                         │   (tracks added by users)
    blends created             │
  (user1Id & user2Id)          └─→ playlistId (FK to playlists)
                                   └─→ User A & B edit shared playlist
```

#### `blend_invites` Table (Self-Referencing User Relation)

```
BlendInvite {
  id: String (CUID) - Primary Key
  senderId: String (FK → users.id) - User sending invite
  receiverId: String (FK → users.id) - User receiving invite
  status: String (default: "pending")
          ├─ "pending" (awaiting response)
          ├─ "accepted" (blend created)
          └─ "rejected" (declined)
  createdAt: DateTime
  respondedAt: DateTime (Optional - only set if accepted/rejected)
  
  Relations:
  ├─ sender: User (FK) - @relation("InviteSender")
  └─ receiver: User (FK) - @relation("InviteReceiver")
  
  Constraints:
  ├─ UNIQUE[senderId, receiverId] - Only one invite per pair
  ├─ [receiverId, status] indexed for pending invites
  └─ Cascade delete: If either user deleted, invite deleted
  
  Design Pattern:
  - SELF-REFERENCING: Two FK to same users table
  - Prevents duplicate invites (unique constraint)
  - Status tracking (pending → accepted → blend created)
}
```

#### `blends` Table

```
Blend {
  id: String (CUID) - Primary Key
  name: String
  user1Id: String (FK → users.id) - First collaborator
  user2Id: String (FK → users.id) - Second collaborator
  playlistId: String (FK → playlists.id, Optional, Unique)
             └─ The shared playlist this blend owns
  createdAt: DateTime
  updatedAt: DateTime
  
  Relations:
  ├─ user1: User (FK) - @relation("BlendUser1")
  ├─ user2: User (FK) - @relation("BlendUser2")
  ├─ playlist: Playlist? (FK)
  └─ tracks: BlendTrack[] (1 → N)
  
  Constraints:
  ├─ UNIQUE[user1Id, user2Id] - One blend per user pair
  ├─ [user1Id] indexed for user's blends
  ├─ [user2Id] indexed for user's blends
  └─ Cascade delete: If either user deleted, blend deleted
  
  Design Pattern:
  - One-to-one with playlists (playlistId is unique)
  - Both users have equal access to shared playlist
  - Tracks stored in blend_tracks (not playlist_tracks)
  - Each track tagged with sourceUserId (who added it)
}
```

#### `blend_tracks` Table

```
BlendTrack {
  id: String (CUID) - Primary Key
  blendId: String (FK → blends.id)
  trackId: String (YouTube Video ID - denormalized)
  title: String (denormalized cache)
  artist: String (denormalized cache)
  thumbnail: String URL (Optional, cache)
  duration: Int (seconds, Optional, cache)
  sourceUserId: String - Which user contributed this track
               ├─ Allows: "Added by User A" vs "Added by User B"
               └─ Audit trail of contributions
  position: Int (ordering within blend)
  addedAt: DateTime
  
  Relations:
  └─ blend: Blend (FK)
  
  Constraints:
  ├─ UNIQUE[blendId, trackId] - No duplicate tracks per blend
  ├─ [blendId] indexed for blend track retrieval
  └─ Cascade delete: If blend deleted, tracks deleted
  
  Design Pattern:
  - Similar to playlist_tracks but with sourceUserId
  - Tracks are DENORMALIZED (no FK to separate table)
  - sourceUserId attribute for contribution tracking
  - Position field for custom ordering
}
```

---

### 4. Listening & Interaction Tracking

```
User Interaction Data Structure:

users
  ├─→ play_history (1-N)
  │   └─ Timestamps, metadata for each play
  │
  ├─→ liked_tracks (1-N)
  │   └─ Favorites marking
  │
  └─→ recommendations (1-N)
      └─ Personalization scores & ranking
```

#### `play_history` Table

```
PlayHistory {
  id: String (CUID) - Primary Key
  userId: String (FK → users.id)
  trackId: String (YouTube Video ID - denormalized)
  title: String (denormalized cache)
  artist: String (denormalized cache)
  thumbnail: String URL (Optional, cache)
  duration: Int (seconds, Optional, cache)
  playedAt: DateTime
  
  Relations:
  └─ user: User (FK)
  
  Constraints:
  ├─ [userId] indexed for user's history
  ├─ [trackId] indexed for track popularity
  ├─ [playedAt] indexed for sorting by recency
  └─ Cascade delete: If user deleted, history deleted
  
  Use Cases:
  ├─ "Recently played" section (ORDER BY playedAt DESC LIMIT 10)
  ├─ "Most played" section (GROUP BY trackId, COUNT(*))
  ├─ "Top artists" section (GROUP BY artist, COUNT(*))
  └─ Analytics & recommendations
}
```

#### `liked_tracks` Table

```
LikedTrack {
  id: String (CUID) - Primary Key
  userId: String (FK → users.id)
  trackId: String (YouTube Video ID - unique per user)
  title: String (denormalized cache)
  artist: String (denormalized cache)
  thumbnail: String URL (Optional, cache)
  duration: Int (seconds, Optional, cache)
  likedAt: DateTime
  
  Relations:
  └─ user: User (FK)
  
  Constraints:
  ├─ UNIQUE[userId, trackId] - No duplicate likes
  ├─ [userId] indexed for user's likes
  ├─ [trackId] indexed for track popularity
  └─ Cascade delete: If user deleted, likes deleted
  
  Use Cases:
  ├─ "Liked Songs" page (all user's likes)
  ├─ Heart icon toggle (is track liked?)
  ├─ Recommendation input (liked tracks boost score)
  └─ Analytics (user preferences)
}
```

#### `recommendations` Table

```
Recommendation {
  id: String (CUID) - Primary Key
  userId: String (FK → users.id)
  trackId: String (YouTube Video ID - unique per user)
  title: String (denormalized cache)
  artist: String (denormalized cache)
  thumbnail: String URL (Optional, cache)
  duration: Int (seconds, Optional, cache)
  source: String ("play", "search", "like")
          └─ How this track was discovered
  score: Float (default: 1.0)
         └─ Recommendation weight for ranking
  playCount: Int (default: 0)
             └─ How many times played
  lastPlayedAt: DateTime (Optional)
                └─ Recency factor
  isLiked: Boolean (default: false)
           └─ Track is in liked_tracks
  likedAt: DateTime (Optional)
           └─ When was it liked
  createdAt: DateTime
  updatedAt: DateTime
  
  Relations:
  └─ user: User (FK)
  
  Constraints:
  ├─ UNIQUE[userId, trackId] - One record per user-track pair
  ├─ [userId] indexed for user's recommendations
  ├─ [score] indexed for ranking
  ├─ [playCount] indexed for popularity
  ├─ [lastPlayedAt] indexed for recency
  └─ Cascade delete: If user deleted, recommendations deleted
  
  Scoring Algorithm:
  ├─ Base score = 1.0
  ├─ +0.5 per play (playCount * 0.5)
  ├─ +1.0 if liked (isLiked)
  ├─ +0.3 if recent play (lastPlayedAt < 7 days)
  └─ Final score used to rank recommendations
  
  Use Cases:
  ├─ Home page "Recently played"
  ├─ Home page "Most played"
  ├─ Home page "Top artists"
  └─ Smart recommendations engine
}
```

---

### 5. Cached / System Tables (Denormalized, No Direct FKs)

These tables optimize performance by storing pre-computed or system-level data.

```
Standalone Tables (Not User-Related):

cached_popular_tracks       system_cache
  │                          │
  ├─ Global data             ├─ Key-value pairs
  ├─ No FK references        ├─ No FK references
  └─ Performance cache       └─ Configuration storage
```

#### `cached_popular_tracks` Table

```
CachedPopularTracks {
  id: String (CUID) - Primary Key
  trackId: String (YouTube Video ID) - UNIQUE
  title: String
  artist: String
  thumbnail: String URL (Optional)
  duration: Int (seconds, Optional)
  playlistCount: Int (default: 1)
                 └─ How many playlists have this track
  updatedAt: DateTime
  
  Relations:
  └─ None (standalone)
  
  Constraints:
  ├─ [trackId] UNIQUE - One cache entry per track
  ├─ [playlistCount] indexed for sorting
  └─ No cascade delete (system data)
  
  Design Pattern:
  - DENORMALIZED cache table
  - Pre-computed from playlist_tracks
  - Updated weekly via cron job
  - Prevents expensive aggregation on each request
  
  Use Cases:
  ├─ Home page "Popular tracks" section
  ├─ Quick trending data without aggregation
  └─ Improves API response time
}
```

#### `system_cache` Table

```
SystemCache {
  id: String (CUID) - Primary Key
  key: String (UNIQUE) - Cache identifier
      └─ Example: "last_popular_aggregation"
  value: String - JSON-serialized data
  updatedAt: DateTime
  
  Relations:
  └─ None (standalone)
  
  Constraints:
  ├─ [key] UNIQUE - One cache entry per key
  └─ No cascade delete (system data)
  
  Design Pattern:
  - Key-value cache for system metadata
  - Stores timestamps, configuration, flags
  - Updated by cron jobs or manual operations
  
  Use Cases:
  ├─ "last_popular_aggregation": timestamp of last cache update
  ├─ "config_*": system configuration flags
  └─ "metadata_*": computed metadata timestamps
}
```

---

### Complete Schema Relationship Tree

```
┌────────────────────────────────────────────────────────────────┐
│                 MusicMu Entity Hierarchy                        │
└────────────────────────────────────────────────────────────────┘

                              users (🔑 Core)
                           /  |  |  |  |  |  \
                    ┌─────┴──┬┴──┬┴──┬┴──┬┴──┴─────┐
                    │        │   │   │   │   │     │
                    ▼        ▼   ▼   ▼   ▼   ▼     ▼
              playlists  play_  liked_ recom- blend- blends
                  │      history tracks mends  invites  │
                  │        │      │      │     (2-way) │
                  ▼        │      │      │             ▼
            playlist_      │      │      │        blend_
            tracks         │      │      │        tracks
                  │        │      │      │             │
                  └────────┴──────┴──────┴──────────────┘
                           │
                           ▼
                  (Shared Playlist via FK)


Legend:
  users       = Primary entity (all others reference this)
  playlists   = User-created playlists (1-N)
  play_history = Listening records (1-N)
  liked_tracks = Favorite marks (1-N)
  recommendations = Personalization data (1-N)
  blend_invites = Collaboration requests (self-referencing)
  blends      = Collaborative playlists (1-N, with 1:1 to playlists)
  blend_tracks = Tracks within blends (1-N)

Standalone (no FK):
  cached_popular_tracks = Performance cache
  system_cache = Metadata key-value storage
```

---

### Relationship Cardinality Summary

| From | To | Type | Constraint | Purpose |
|------|----|----|-----------|---------|
| `users` | `playlists` | 1→N | Cascade delete | User owns playlists |
| `users` | `play_history` | 1→N | Cascade delete | Track user plays |
| `users` | `liked_tracks` | 1→N | Cascade delete | User likes tracks |
| `users` | `recommendations` | 1→N | Cascade delete | Personalization |
| `users` | `blend_invites` (send) | 1→N | Cascade delete | User sends invites |
| `users` | `blend_invites` (recv) | 1→N | Cascade delete | User receives invites |
| `users` | `blends` | 1→N | Cascade delete | User collaborates |
| `playlists` | `playlist_tracks` | 1→N | Cascade delete | Playlist has tracks |
| `blends` | `blend_tracks` | 1→N | Cascade delete | Blend has tracks |
| `blends` | `playlists` | 1→1 | SetNull | Blend shares playlist |

---

### Relationship Design Patterns

#### 1. **Primary Entity Pattern** (Users)
- All tables reference `users.id`
- Central hub for all operations
- Cascade delete maintains referential integrity
- Enables multi-tenancy (each user's isolated data)

```sql
-- Example: Get all user data
SELECT * FROM users u
WHERE u.id = 'user123'
  AND u.email = 'user@example.com';

-- Cascade delete example:
DELETE FROM users WHERE id = 'user123';
-- Automatically deletes: playlists, playlist_tracks, play_history, liked_tracks, etc.
```

#### 2. **Denormalization Pattern** (Track Metadata)
- Track metadata cached in multiple tables
- No separate `tracks` table
- YouTube Video ID used as primary identifier
- Benefits:
  - Fast queries (no JOINs needed)
  - Immutable history (metadata snapshots)
  - No orphaned records
  
```sql
-- Example: Show user's play history with all track details
SELECT * FROM play_history
WHERE userId = 'user123'
ORDER BY playedAt DESC
LIMIT 10;
-- Returns: trackId, title, artist, thumbnail, duration
-- No JOIN needed!
```

#### 3. **Self-Referencing Pattern** (Blend Invites)
- `blend_invites` references `users` table twice
- Prevents circular dependency
- Unique constraint ensures one invite per pair

```typescript
// In Prisma schema:
model BlendInvite {
  senderId: String
  receiverId: String
  sender: User @relation("InviteSender", fields: [senderId], references: [id])
  receiver: User @relation("InviteReceiver", fields: [receiverId], references: [id])
  
  @@unique([senderId, receiverId])  // Only one invite per pair
}

// Example: Find all invites User A received
SELECT * FROM blend_invites
WHERE receiverId = 'userA'
  AND status = 'pending';
```

#### 4. **Unique Pair Pattern** (No Duplicates)
- Used in `blend_invites` and `blends`
- Prevents multiple blends between same users
- Database enforces at storage level

```sql
-- Example: Prevent duplicate blends
CREATE UNIQUE INDEX blend_users_unique ON blends(
  LEAST(user1Id, user2Id),
  GREATEST(user1Id, user2Id)
);

-- This prevents: Blend(A→B) and Blend(B→A) being created twice
```

#### 5. **One-to-One Unique Pattern** (Blend → Playlist)
- Each blend has optional associated playlist
- Playlist unique to one blend
- Enables shared editing

```typescript
// Blend "owns" a shared playlist
model Blend {
  playlistId: String? @unique  // Unique FK
  playlist: Playlist? @relation("BlendPlaylist", fields: [playlistId])
}

// Example: Get blend's shared playlist
SELECT b.*, p.*
FROM blends b
LEFT JOIN playlists p ON b.playlistId = p.id
WHERE b.id = 'blend123';
```

---

### Indexing Strategy

**Why Indexes Matter:**
- Fast filtering (WHERE clauses)
- Fast sorting (ORDER BY)
- Fast uniqueness checks
- Prevents duplicate entries

**Indexes in MusicMu:**

| Table | Columns | Purpose |
|-------|---------|---------|
| `users` | `email`, `username` | Fast login lookup |
| `playlists` | `userId` | Get user's playlists |
| `playlist_tracks` | `playlistId` | Get playlist's tracks |
| `play_history` | `userId`, `trackId`, `playedAt` | User history, popularity, sorting |
| `liked_tracks` | `userId`, `trackId` | User likes, track popularity |
| `recommendations` | `userId`, `score`, `playCount`, `lastPlayedAt` | Personalization queries |
| `blend_invites` | `receiverId + status` | Pending invites for user |
| `blends` | `user1Id`, `user2Id` | User's blends |
| `blend_tracks` | `blendId` | Blend's tracks |
| `cached_popular_tracks` | `playlistCount` | Trending tracks |

---

### Data Flow Through Relationships

#### Example 1: User Likes a Track

```
User clicks Heart on track
  ↓
POST /api/likes { trackId, title, artist, ... }
  ↓
Backend creates LikedTrack:
  ├─ userId: from JWT
  ├─ trackId: from request
  ├─ title, artist: from request (denormalized)
  └─ likedAt: now()
  ↓
Also updates Recommendation:
  ├─ If exists: set isLiked = true, likedAt = now()
  └─ If not: create new with score boost
  ↓
Frontend: Like state updated in Zustand
  ↓
Next time: Home page recommendations updated
```

#### Example 2: Create Blend with Friend

```
User A sends invite to User B
  ↓
POST /api/blends/invite { email: 'B@example.com' }
  ↓
Create BlendInvite:
  ├─ senderId: A (from JWT)
  ├─ receiverId: B (looked up by email)
  ├─ status: "pending"
  └─ createdAt: now()
  ↓
User B receives notification
  ↓
User B clicks "Accept"
  ↓
Update BlendInvite:
  ├─ status: "accepted"
  └─ respondedAt: now()
  ↓
Create Blend:
  ├─ user1Id: A
  ├─ user2Id: B
  ├─ name: "Blend: A + B"
  └─ playlistId: (new shared playlist created)
  ↓
Users A & B can now:
  ├─ POST /api/blends/{id}/tracks (add songs)
  ├─ Both get BlendTracks with sourceUserId
  └─ Edit shared playlist together
```

#### Example 3: Get Personalized Recommendations

```
GET /api/recommendations (authenticated)
  ↓
Query 1: Recently Played
  SELECT * FROM play_history
  WHERE userId = 'user123'
  ORDER BY playedAt DESC
  LIMIT 10 UNIQUE tracks;
  ↓
Query 2: Most Played
  SELECT *, COUNT(*) as playCount
  FROM play_history
  WHERE userId = 'user123'
  GROUP BY trackId
  ORDER BY playCount DESC
  LIMIT 10;
  ↓
Query 3: Top Artists
  SELECT artist, COUNT(*) as playCount
  FROM play_history
  WHERE userId = 'user123'
  GROUP BY artist
  ORDER BY playCount DESC
  LIMIT 5;
  ↓
For each top artist:
  SELECT * FROM play_history
  WHERE userId = 'user123'
    AND artist = '{topArtist}'
  LIMIT 3 sample tracks;
  ↓
Return aggregated recommendations to frontend
```

---

### Cascade Delete Behavior

**What happens when a user is deleted:**

```
DELETE FROM users WHERE id = 'user123'
  ↓
Cascade deletes all:
  ├─ playlists (+ playlist_tracks)
  ├─ play_history
  ├─ liked_tracks
  ├─ recommendations
  ├─ blend_invites (sent as sender)
  ├─ blend_invites (received as receiver)
  ├─ blends (where user1 OR user2)
  │  └─ blend_tracks (cascade via blend)
  └─ No users left to reference

Result: User's data completely removed
```

**What happens when a playlist is deleted:**

```
DELETE FROM playlists WHERE id = 'playlist123'
  ↓
Cascade deletes:
  ├─ playlist_tracks
  ├─ blends (if playlistId = playlist123)
  │  └─ blend_tracks (cascade via blend)
  └─ Blend invites unaffected

Result: Playlist & associated tracks removed
```

---

### Relational Integrity Constraints

**Unique Constraints:**
```sql
-- User login prevents duplicates
ALTER TABLE users ADD UNIQUE(email);
ALTER TABLE users ADD UNIQUE(username);

-- No duplicate likes per user
ALTER TABLE liked_tracks ADD UNIQUE(userId, trackId);

-- No duplicate playlist tracks
ALTER TABLE playlist_tracks ADD UNIQUE(playlistId, trackId);

-- One invite per user pair
ALTER TABLE blend_invites ADD UNIQUE(senderId, receiverId);

-- One blend per user pair
ALTER TABLE blends ADD UNIQUE(user1Id, user2Id);

-- No duplicate blend tracks
ALTER TABLE blend_tracks ADD UNIQUE(blendId, trackId);

-- One blend owns playlist
ALTER TABLE blends ADD UNIQUE(playlistId);
```

**Foreign Key Constraints:**
```sql
-- All tables reference users with cascade
ALTER TABLE playlists ADD CONSTRAINT fk_user
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE blend_invites ADD CONSTRAINT fk_sender
  FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE blend_invites ADD CONSTRAINT fk_receiver
  FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE;

-- Blends reference both users
ALTER TABLE blends ADD CONSTRAINT fk_user1
  FOREIGN KEY (user1Id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE blends ADD CONSTRAINT fk_user2
  FOREIGN KEY (user2Id) REFERENCES users(id) ON DELETE CASCADE;

-- Blends optionally reference playlists
ALTER TABLE blends ADD CONSTRAINT fk_playlist
  FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE SET NULL;
```

---

### User Model

### LikedTrack Model
```
LikedTrack {
  id: String (CUID)
  userId: String (FK → User)
  trackId: String (YouTube Video ID)
  title: String
  artist: String
  thumbnail: String URL (Optional)
  duration: Int (seconds, Optional)
  likedAt: DateTime
  
  Indexes:
  ├─ [userId] - Fast lookup of user's likes
  ├─ [trackId] - Track popularity
  └─ UNIQUE[userId, trackId] - Prevent duplicates
}
```

### Playlist Model
```
Playlist {
  id: String (CUID)
  userId: String (FK → User)
  name: String
  description: String (Optional)
  thumbnail: String URL (Optional)
  isPublic: Boolean (default: false)
  createdAt: DateTime
  updatedAt: DateTime
  
  Relations:
  ├─ user: User
  ├─ tracks: PlaylistTrack[]
  └─ blend: Blend? (one-to-one if part of blend)
}
```

### PlaylistTrack Model
```
PlaylistTrack {
  id: String (CUID)
  playlistId: String (FK → Playlist)
  trackId: String (YouTube Video ID)
  title: String
  artist: String
  thumbnail: String URL (Optional)
  duration: Int (seconds, Optional)
  position: Int (ordering)
  addedAt: DateTime
  
  Indexes:
  ├─ [playlistId] - Track retrieval
  └─ UNIQUE[playlistId, trackId] - Prevent duplicates
}
```

### PlayHistory Model
```
PlayHistory {
  id: String (CUID)
  userId: String (FK → User)
  trackId: String (YouTube Video ID)
  title: String
  artist: String
  thumbnail: String URL (Optional)
  duration: Int (seconds, Optional)
  playedAt: DateTime
  
  Indexes:
  ├─ [userId] - User's history lookup
  ├─ [trackId] - Track popularity
  └─ [playedAt] - Sort by recency
}
```

### Recommendation Model
```
Recommendation {
  id: String (CUID)
  userId: String (FK → User)
  trackId: String (YouTube Video ID)
  title: String
  artist: String
  thumbnail: String URL (Optional)
  duration: Int (seconds, Optional)
  source: String ("play", "search", "like")
  score: Float (default: 1.0) - Recommendation weight
  playCount: Int (default: 0)
  lastPlayedAt: DateTime (Optional)
  isLiked: Boolean (default: false)
  likedAt: DateTime (Optional)
  createdAt: DateTime
  updatedAt: DateTime
  
  Indexes:
  ├─ [userId] - User's recommendations
  ├─ [score] - Ranking by weight
  ├─ [playCount] - Popular tracks
  ├─ [lastPlayedAt] - Recent plays
  └─ UNIQUE[userId, trackId]
}
```

### BlendInvite Model
```
BlendInvite {
  id: String (CUID)
  senderId: String (FK → User)
  receiverId: String (FK → User)
  status: String (default: "pending") - "pending", "accepted", "rejected"
  createdAt: DateTime
  respondedAt: DateTime (Optional)
  
  Relations:
  ├─ sender: User
  └─ receiver: User
  
  Indexes:
  ├─ UNIQUE[senderId, receiverId]
  └─ [receiverId, status] - Fetch pending invites
}
```

### Blend Model
```
Blend {
  id: String (CUID)
  name: String
  user1Id: String (FK → User)
  user2Id: String (FK → User)
  playlistId: String (FK → Playlist, Optional, Unique)
  createdAt: DateTime
  updatedAt: DateTime
  
  Relations:
  ├─ user1: User
  ├─ user2: User
  ├─ playlist: Playlist?
  └─ tracks: BlendTrack[]
  
  Indexes:
  ├─ UNIQUE[user1Id, user2Id] - One blend per pair
  ├─ [user1Id]
  └─ [user2Id]
}
```

### BlendTrack Model
```
BlendTrack {
  id: String (CUID)
  blendId: String (FK → Blend)
  trackId: String (YouTube Video ID)
  title: String
  artist: String
  thumbnail: String URL (Optional)
  duration: Int (seconds, Optional)
  sourceUserId: String - Which user contributed
  position: Int (ordering)
  addedAt: DateTime
  
  Relations:
  └─ blend: Blend
  
  Indexes:
  ├─ [blendId]
  └─ UNIQUE[blendId, trackId]
}
```

### CachedPopularTracks Model
```
CachedPopularTracks {
  id: String (CUID)
  trackId: String (YouTube Video ID, Unique)
  title: String
  artist: String
  thumbnail: String URL (Optional)
  duration: Int (seconds, Optional)
  playlistCount: Int (default: 1) - How many playlists have it
  updatedAt: DateTime
  
  Indexes:
  └─ [playlistCount] - Sort by popularity
}
```

### SystemCache Model
```
SystemCache {
  id: String (CUID)
  key: String (Unique) - e.g., "last_popular_aggregation"
  value: String - JSON-serialized value
  updatedAt: DateTime
}
```

---

## Frontend Pages & Features

### Page Overview

```
┌─────────────────────────────────────────────┐
│          Frontend Route Structure            │
├─────────────────────────────────────────────┤
│                                             │
│  /                          Home Page       │
│  /search                    Search Page     │
│  /login                     Login Page      │
│  /register                  Register Page   │
│  /profile                   Profile Page    │
│  /liked                     Liked Songs     │
│  /queue                     Queue Manager   │
│  /playlists                 Playlists      │
│  /playlist/:id              Playlist Detail │
│  /blends                    Blends List     │
│  /blends/:id                Blend Detail    │
│                                             │
└─────────────────────────────────────────────┘
```

### 1. Home Page (`/`)

**Purpose**: Main hub with personalized recommendations and discovered tracks

**Key Features**:
- Shows "Now Playing" mini-card when track is active
- Displays personalized recommendations (authenticated users)
- Shows recently played tracks
- Shows most-played tracks with play counts
- Top artists with play frequency
- Popular tracks cache for trending content
- Discovered tracks from previous searches

**Data Flow**:
```
User Opens Home
    ↓
Check Authentication (useAuth)
    ├─ If Authenticated: Fetch from /api/recommendations
    └─ If Guest: Use getReverseQueue from cache
    ↓
Display Recommendations in 4 sections:
├─ Now Playing (if track active)
├─ Recently Played (last 10 unique)
├─ Most Played (by play count)
├─ Top Artists (grouped by artist)
└─ Popular Tracks (cached)
    ↓
User can click to play any track
```

**State Management**:
- `useAuth` - Current user authentication
- `usePlayer` - Current playing track
- Local state for recommendation data

### 2. Search Page (`/search`)

**Purpose**: YouTube-powered search with infinite load-more

**Key Features**:
- Real-time search input
- Load-more functionality (10 → 20 → 30... → 50 max)
- Display tracks with thumbnail, title, artist, duration
- Like/Unlike toggle on each track
- Add to queue button
- Play selected track + auto-queue remaining results
- Show loading states

**Logic**:
```javascript
handleSearch(query) {
  // Call usePlayer.search(query, limit=10)
  // Calls backend /api/search endpoint
  // Backend filters: 1-10 minutes duration
  // Returns up to `limit` results
}

handleLoadMore() {
  // Increment limit (min 10, max 50)
  // Re-fetch with new limit
  // Append to existing results
}

handlePlay(track, index) {
  // Play this track
  // Add all tracks after it to queue
  // Allows continuous playback
}
```

**State**:
- `query` - Search input
- `results` - Array of Track objects
- `currentLimit` - Current fetch limit
- `loading` - Fetch state

### 3. Login Page (`/login`)

**Purpose**: User authentication

**Flow**:
```
User Enters Email + Password
    ↓
POST /api/auth/login
    ↓
Backend: Hash password, compare with DB
    ├─ Match: Return { user, token }
    └─ No Match: Return 401 error
    ↓
Frontend: Call useAuth.setAuth(token, user)
    ├─ Save to IndexedDB (authStorage)
    ├─ Update Zustand state
    └─ Trigger syncFromDatabase()
    ↓
Redirect to Home page
```

**Validation**:
- Email required + valid format
- Password required (min 6 chars typically)

### 4. Register Page (`/register`)

**Purpose**: New user signup

**Flow**:
```
User Enters Email + Password + Optional Name
    ↓
POST /api/auth/register
    ↓
Backend:
  ├─ Check if email/username already exists
  ├─ Hash password with bcryptjs
  └─ Create user in database
    ↓
Return { user, token }
    ↓
Frontend: Same as login flow
```

**Auto-Username Generation**:
```
If no username provided:
  username = email.split('@')[0] + '_' + randomString(4)
  Example: "john_abc123"
```

### 5. Profile Page (`/profile`)

**Purpose**: User settings and statistics

**Features**:
- Display user profile (name, email, avatar)
- User statistics (total plays, liked tracks, etc.)
- Logout button
- Theme/settings (extensible)

### 6. Liked Songs Page (`/liked`)

**Purpose**: View all liked tracks

**Features**:
- Fetch from `/api/likes`
- Display grid/list of liked tracks
- Remove from likes button
- Play track button
- Add to playlist dropdown
- Sort/filter options

**Data Flow**:
```
On Mount: fetchLikedTracks()
    ↓
GET /api/likes (with JWT)
    ↓
Backend: Query LikedTrack where userId = current
    ↓
Return array of liked tracks
    ↓
Display with thumbnail, title, artist
```

### 7. Queue Page (`/queue`)

**Purpose**: Manage playback queue

**Features**:
- Show forward queue (songs to play)
- Show reverse queue (history - songs played)
- Drag-to-reorder queue items
- Remove from queue
- Current playing highlighted
- Jump to any track

**Dual Queue Logic**:
```
Queue Structure:
├─ Forward Queue: Songs coming up
├─ Reverse Queue: Songs already played (stack-like)
└─ Current Track: Currently playing

When Play() is called:
  1. Move current to reverseQueue
  2. Pop next from queue
  3. Set as currentTrack

When Next() is called:
  1. Move current to reverseQueue
  2. Pop from queue (or stop)
  3. Play next

When Prev() is called:
  1. Move current to front of queue
  2. Pop from reverseQueue
  3. Play previous
```

### 8. Playlists Page (`/playlists`)

**Purpose**: User's custom playlists management

**Features**:
- List all user playlists
- Create new playlist button
- Click to view playlist details
- Delete playlist
- Show track count per playlist

**Logic**:
```
GET /api/playlists (fetch all)
    ↓
Display as grid/list cards
    ↓
User can:
  ├─ Click to view details
  ├─ Create new via modal
  └─ Delete (with confirmation)
```

### 9. Playlist Detail Page (`/playlist/:id`)

**Purpose**: View and edit specific playlist

**Features**:
- Show playlist metadata
- Display all tracks in order
- Remove track from playlist
- Reorder tracks (drag & drop)
- Play playlist button
- Add tracks from search/liked

**Data Flow**:
```
On Mount: GET /api/playlists/:id
    ↓
Backend: Find playlist (check ownership or isPublic)
    ↓
Include all tracks ordered by position
    ↓
Display tracks with controls
```

### 10. Blends Page (`/blends`)

**Purpose**: Collaborative playlists with friends

**Features**:
- List all blends (created or joined)
- Send blend invite button
- Modal to enter friend's email
- Real-time notifications for new invites

**Invite Flow**:
```
User clicks "Create Blend" → Enter Email
    ↓
POST /api/blends/invite (with email)
    ↓
Backend:
  ├─ Find user by email
  ├─ Check no existing invite
  └─ Create BlendInvite record
    ↓
Receiver gets notification (polling or WebSocket)
    ↓
Receiver can Accept/Reject
    ├─ Accept: Create Blend record
    └─ Reject: Update status
```

**Notifications Component**:
- Polls `/api/blends/invites` periodically
- Shows toast for new invites
- Quick accept/reject buttons

### 11. Blend Detail Page (`/blends/:id`)

**Purpose**: View and manage blend playlist

**Features**:
- Show both collaborators
- Display all blend tracks
- Each track tagged with source user
- Remove track option (for owner)
- Add new tracks to blend
- Show contribution stats

**Data**:
```
Blend {
  id, name, user1, user2, playlist
}

BlendTracks {
  Array of tracks with sourceUserId
  Shows who added each track
}
```

---

## Backend Routes & Logic

### 1. Authentication Routes (`/api/auth/*`)

#### POST /auth/register
```typescript
Input: {
  email: string (required, unique)
  password: string (required, min 6 chars)
  name?: string (optional)
  username?: string (optional, auto-generated)
}

Process:
  1. Validate input with Zod schema
  2. Check if email already exists
  3. Auto-generate username if not provided
  4. Hash password with bcryptjs (10 rounds)
  5. Create user in database
  6. Sign JWT token

Output: {
  user: { id, email, username, name, avatar, createdAt },
  token: JWT
}

Error Codes:
  ├─ 400: Validation failed
  ├─ 409: Email/username already exists
  └─ 500: Database error
```

#### POST /auth/login
```typescript
Input: {
  email: string (required)
  password: string (required)
}

Process:
  1. Validate input
  2. Find user by email
  3. Compare password hash
  4. If valid: Sign JWT

Output: {
  user: { id, email, username, name, avatar, createdAt },
  token: JWT
}

Error Codes:
  ├─ 401: Invalid email or password
  └─ 500: Server error
```

#### GET /auth/me (Protected)
```typescript
Process:
  1. Extract user from JWT
  2. Fetch latest user data from DB

Output:
  user: { id, email, username, name, avatar, createdAt }

Error:
  ├─ 401: Unauthorized (no/invalid token)
  └─ 404: User not found
```

---

### 2. Search Routes (`/api/search`)

#### GET /search?q=query&limit=10
```typescript
Process:
  1. Extract query parameter (required)
  2. Extract limit (optional, default 10)
  3. Call Innertube.search(query, type='video')
  
  4. Filter results:
     └─ Duration must be 60-600 seconds (1-10 min)
  
  5. Extract metadata:
     ├─ videoId (YouTube ID)
     ├─ title
     ├─ author (artist)
     ├─ duration (seconds)
     └─ thumbnail (best quality)
  
  6. Sort by relevance (default Innertube order)
  7. Slice to limit

Output: {
  results: [
    {
      videoId: string,
      title: string,
      artist: string,
      duration: number (seconds),
      thumbnail: string (URL)
    }
  ]
}

Logic:
  Why 1-10 minutes?
  - Too short: Likely not full songs (intros, snippets)
  - Too long: Likely live performances, mixes, or videos
  - Sweet spot: Actual music tracks (avg 3-4 min)
```

#### GET /track/:id
```typescript
Process:
  1. Get video ID from params
  2. Call Innertube.getBasicInfo(videoId)
  3. Extract: title, author, duration, thumbnail

Output: {
  videoId: string,
  title: string,
  artist: string,
  duration: number,
  thumbnail: string
}
```

#### GET /track/:id/stream
```typescript
Process:
  No API call needed - just return IFrame URL

Output: {
  mode: 'iframe',
  url: 'https://www.youtube.com/embed/{videoId}?autoplay=1&enablejsapi=1'
}

Why IFrame only?
- Official YouTube embedding (ToS compliant)
- No need to extract/store audio URLs
- Player API handles all auth + rate limiting
- Works on any CORS-enabled origin
```

---

### 3. Likes Routes (`/api/likes/*`)

#### GET /likes (Protected)
```typescript
Process:
  1. Extract userId from JWT
  2. Query LikedTrack where userId = current
  3. Order by likedAt DESC

Output: {
  likedTracks: [
    {
      id: string,
      trackId: string,
      title: string,
      artist: string,
      thumbnail: string,
      duration: number,
      likedAt: DateTime
    }
  ]
}
```

#### POST /likes (Protected)
```typescript
Input: {
  trackId: string (YouTube ID)
  title: string
  artist: string
  thumbnail: string
  duration: number
}

Process:
  1. Check if track already liked (unique constraint)
  2. Create LikedTrack record
  3. Update recommendation score (if exists)

Output: {
  id: string,
  likedAt: DateTime
}

Also updates:
  - Recommendation.isLiked = true
  - Recommendation.likedAt = now()
```

#### DELETE /likes/:trackId (Protected)
```typescript
Process:
  1. Find LikedTrack by trackId + userId
  2. Delete record
  3. Update recommendation

Output: { success: true }
```

#### GET /likes/:trackId (Protected)
```typescript
Output: {
  isLiked: boolean
}
```

---

### 4. Playlists Routes (`/api/playlists/*`)

#### GET /playlists (Protected)
```typescript
Process:
  1. Query Playlist where userId = current
  2. Include track count

Output: {
  playlists: [
    {
      id: string,
      name: string,
      description: string,
      thumbnail: string,
      isPublic: boolean,
      _count: { tracks: number }
    }
  ]
}
```

#### POST /playlists (Protected)
```typescript
Input: {
  name: string (required)
  description?: string
  isPublic?: boolean (default: false)
}

Process:
  1. Validate with Zod schema
  2. Create Playlist record

Output: {
  playlist: {
    id: string,
    name: string,
    description: string,
    isPublic: boolean,
    _count: { tracks: 0 }
  }
}
```

#### GET /playlists/:id (Protected)
```typescript
Process:
  1. Check if user owns playlist OR isPublic
  2. Include all tracks ordered by position
  3. Include creator user info

Output: {
  playlist: {
    id: string,
    name: string,
    description: string,
    thumbnail: string,
    isPublic: boolean,
    user: { id, username, name, avatar },
    tracks: [
      {
        id: string,
        trackId: string,
        title: string,
        artist: string,
        thumbnail: string,
        duration: number,
        position: number,
        addedAt: DateTime
      }
    ]
  }
}
```

#### POST /playlists/:id/tracks (Protected)
```typescript
Input: {
  trackId: string
  title: string
  artist: string
  thumbnail: string
  duration: number
}

Process:
  1. Check if user owns playlist
  2. Find highest position in playlist
  3. Create PlaylistTrack (position = max + 1)

Output: {
  track: PlaylistTrack
}

Constraint: Prevents duplicate tracks (unique[playlistId, trackId])
```

#### DELETE /playlists/:id/tracks/:trackId (Protected)
```typescript
Process:
  1. Check ownership
  2. Delete PlaylistTrack
  3. Re-order remaining tracks by position

Output: { success: true }
```

#### GET /playlists/discover/popular (Protected)
```typescript
Process:
  1. Query CachedPopularTracks
  2. Order by playlistCount DESC
  3. Limit to 50-100 popular tracks

Output: {
  tracks: [
    {
      trackId: string,
      title: string,
      artist: string,
      thumbnail: string,
      duration: number,
      playlistCount: number
    }
  ]
}

Cache Strategy:
  - Aggregated weekly from all playlists
  - Updated via background job
  - Prevents expensive runtime aggregation
```

---

### 5. History Routes (`/api/history/*`)

#### GET /history?limit=50&offset=0 (Protected)
```typescript
Process:
  1. Query PlayHistory where userId = current
  2. Order by playedAt DESC
  3. Paginate with limit + offset

Output: {
  history: [
    {
      id: string,
      trackId: string,
      title: string,
      artist: string,
      thumbnail: string,
      duration: number,
      playedAt: DateTime
    }
  ]
}

Use Cases:
  - Get recently played tracks
  - Paginate through listening history
  - Show trends over time
```

#### POST /history (Protected)
```typescript
Input: {
  trackId: string
  title: string
  artist: string
  thumbnail: string
  duration: number
}

Process:
  1. Create PlayHistory record
  2. Update Recommendation:
     ├─ Increment playCount
     ├─ Set lastPlayedAt = now()
     └─ Update score based on frequency

Output: { success: true }

Trigger: Called when track finishes or user skips
```

---

### 6. Recommendations Routes (`/api/recommendations/*`)

#### GET /recommendations (Protected)
```typescript
Process:
  1. Get Recently Played (last 10 unique tracks)
     - Query last 50 play history records
     - Deduplicate by trackId
     - Return 10 most recent

  2. Get Most Played (aggregate by trackId)
     - GROUP BY trackId
     - Count occurrences
     - Order by _count DESC
     - Limit to 10

  3. Get Top Artists (aggregate by artist name)
     - GROUP BY artist
     - Count occurrences
     - Order by _count DESC
     - Get top 5 artists
     - For each artist: get 3-5 sample tracks

Output: {
  recommendations: {
    recentlyPlayed: Track[],
    mostPlayed: Track[],
    topArtists: [
      {
        name: string,
        playCount: number,
        tracks: Track[]
      }
    ]
  }
}

Logic:
  - Recently Played: Discover new music related to recent listening
  - Most Played: Favorite verified tracks
  - Top Artists: See listening patterns by artist
```

---

### 7. Blends Routes (`/api/blends/*`)

#### POST /blends/invite (Protected)
```typescript
Input: {
  email: string (receiver's email)
}

Process:
  1. Find receiver by email
  2. Check receiver exists
  3. Check not inviting self
  4. Check no existing invite (either direction)
  5. Create BlendInvite record

Output: {
  invite: {
    id: string,
    sender: { id, name, email, avatar },
    receiver: { id, name, email, avatar },
    status: 'pending',
    createdAt: DateTime
  }
}

Errors:
  ├─ 404: User not found
  ├─ 400: Self-invite
  └─ 409: Invite already exists
```

#### GET /blends/invites (Protected)
```typescript
Process:
  1. Query BlendInvite where:
     ├─ receiverId = current user
     └─ status = 'pending'
  2. Include sender info

Output: {
  invites: [
    {
      id: string,
      sender: { id, name, email, avatar },
      status: 'pending',
      createdAt: DateTime
    }
  ]
}
```

#### POST /blends/invites/:id/accept (Protected)
```typescript
Process:
  1. Verify invite exists + pending + receiver is current user
  2. Update invite: status = 'accepted', respondedAt = now()
  3. Create Blend record:
     ├─ name = "Blend: {User1} + {User2}"
     ├─ user1Id = invite.senderId
     ├─ user2Id = invite.receiverId
     └─ playlistId = null (auto-create)
  4. Create empty Playlist for blend

Output: {
  blend: {
    id: string,
    name: string,
    user1: User,
    user2: User,
    playlistId: string,
    createdAt: DateTime
  }
}
```

#### POST /blends/invites/:id/reject (Protected)
```typescript
Process:
  1. Verify invite + receiver
  2. Update: status = 'rejected', respondedAt = now()

Output: { success: true }
```

#### GET /blends (Protected)
```typescript
Process:
  Query all Blend where user1Id OR user2Id = current
  Include both users + playlist info

Output: {
  blends: [
    {
      id: string,
      name: string,
      user1: User,
      user2: User,
      playlistId: string,
      createdAt: DateTime
    }
  ]
}
```

#### GET /blends/:id (Protected)
```typescript
Process:
  1. Check user is participant
  2. Get blend with both users
  3. Get all blend tracks ordered by position
  4. Get associated playlist

Output: {
  blend: {
    id: string,
    name: string,
    user1: User,
    user2: User,
    playlist: Playlist,
    tracks: [
      {
        id: string,
        trackId: string,
        title: string,
        artist: string,
        sourceUserId: string (who added),
        position: number,
        addedAt: DateTime
      }
    ]
  }
}
```

#### POST /blends/:id/tracks (Protected)
```typescript
Input: {
  trackId: string
  title: string
  artist: string
  thumbnail: string
  duration: number
}

Process:
  1. Check user is blend participant
  2. Get max position in blend
  3. Create BlendTrack:
     ├─ blendId = blend.id
     ├─ trackId = input.trackId
     ├─ sourceUserId = current user
     ├─ position = max + 1
     └─ addedAt = now()
  4. Also add to associated playlist

Output: { success: true }
```

---

## Data Flow Diagrams

### 1. Complete Music Play Flow

```
┌─────────────────────────────────────────────────────────┐
│             MUSIC PLAYBACK FLOW                         │
└─────────────────────────────────────────────────────────┘

1. USER CLICKS PLAY ON TRACK
   ↓
   usePlayer.play(track)

2. LOAD TRACK METADATA
   (if not in cache)
   ↓
   GET /api/track/:id
   ↓
   Extract: title, artist, duration, thumbnail
   ↓
   Store in memory (currentTrack)

3. INITIALIZE YOUTUBE IFRAME PLAYER
   ↓
   Load YouTube IFrame API SDK
   ↓
   Create player instance
   ↓
   Load video: player.loadVideoById(videoId)

4. PLAYBACK
   ├─ Play: player.playVideo()
   ├─ Pause: player.pauseVideo()
   ├─ Seek: player.seekTo(seconds)
   └─ Volume: player.setVolume(0-100)

5. RECORD PLAY HISTORY (if authenticated)
   ├─ On track end OR every 30 seconds
   ├─ POST /api/history
   ├─ Update PlayHistory record
   └─ Update Recommendation metrics

6. QUEUE MANAGEMENT
   ├─ Move current → reverseQueue
   ├─ Pop next track from queue
   ├─ Repeat step 2-5

7. WAKE LOCK (Mobile)
   ├─ Acquire screen wake lock
   ├─ Keep screen awake during playback
   └─ Release on pause
```

### 2. Guest vs. Authenticated Data Flow

```
┌────────────────────────────────────┐
│      GUEST MODE (No Login)         │
├────────────────────────────────────┤
│                                    │
│  User Actions                      │
│       ↓                            │
│  Zustand (usePlayer)               │
│       ↓                            │
│  IndexedDB (localforage)           │
│       ↓                            │
│  YouTube IFrame API                │
│                                    │
│  Limitations:                      │
│  - No cloud sync                   │
│  - Clears after 30 days            │
│  - No collaborative features       │
│  - Local-only liked/playlists      │
│                                    │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│   AUTHENTICATED (With Login)       │
├────────────────────────────────────┤
│                                    │
│  User Actions                      │
│       ↓                            │
│  Zustand (usePlayer)               │
│       ├─→ IndexedDB (cache)        │
│       ├─→ Fastify API (database)   │
│       └─→ YouTube IFrame API       │
│                                    │
│  Benefits:                         │
│  ✓ Cloud sync all data             │
│  ✓ Multi-device access             │
│  ✓ Collaborative blends            │
│  ✓ Analytics (top tracks, etc)     │
│  ✓ Persistent history              │
│                                    │
│  Post-Login Flow:                  │
│  1. Save auth to IndexedDB         │
│  2. Trigger syncFromDatabase()     │
│  3. Fetch likes, playlists, etc    │
│  4. Merge with local cache         │
│                                    │
└────────────────────────────────────┘
```

### 3. Search to Play Pipeline

```
USER TYPES QUERY
    ↓
onChange → setQuery(input)
    ↓
onSubmit → handleSearch()
    ↓
usePlayer.search(query, limit=10)
    ↓
GET /api/search?q={query}&limit=10
    ↓
INNERTUBE.SEARCH(query, type='video')
    ↓
FILTER RESULTS
├─ Remove videos without ID/title
├─ Remove videos < 60s or > 600s
└─ Keep only {videoId, title, artist, duration, thumbnail}
    ↓
SORT BY INNERTUBE SCORE (default)
    ↓
RETURN [Track[], ...]
    ↓
Frontend: setResults(results)
    ↓
RENDER SEARCH RESULTS
├─ Thumbnail + Title + Artist + Duration
├─ Like button
├─ Add to queue button
└─ Play button
    ↓
USER CLICKS PLAY ON TRACK
    ↓
usePlayer.play(track)
    ↓
LOAD YOUTUBE IFRAME
    ↓
PLAYBACK
    ↓
ON PLAY FINISH:
├─ Record in history (if auth)
├─ Pop next from queue
└─ Auto-play next track
```

### 4. Like/Playlist Save Flow

```
USER CLICKS LIKE HEART
    ↓
usePlayer.like(track)
    ↓
IF AUTHENTICATED:
├─ POST /api/likes (with JWT)
├─ Backend: Create LikedTrack record
├─ Backend: Update Recommendation.isLiked = true
└─ Frontend: Update Zustand like cache
    ↓
IF GUEST:
├─ Save to IndexedDB cache.liked[]
├─ No server persistence
└─ Data lost after 30 days
    ↓
UI: Show heart as filled/red


USER CLICKS "ADD TO PLAYLIST"
    ↓
Show dropdown of user's playlists
    ↓
SELECT PLAYLIST
    ↓
IF AUTHENTICATED:
├─ POST /api/playlists/{id}/tracks
├─ Backend: Create PlaylistTrack
├─ Backend: Update position counter
└─ Frontend: Update playlist in cache
    ↓
IF GUEST:
├─ Save to IndexedDB cache.playlists[]{tracks[]}
└─ No server persistence
    ↓
UI: Show confirmation toast
```

### 5. Authentication & Sync Flow

```
USER CLICKS LOGIN
    ↓
Enter Email + Password
    ↓
POST /api/auth/login
    ↓
Backend:
├─ Find user by email
├─ Verify password hash
├─ Create JWT token
└─ Return { user, token }
    ↓
Frontend: useAuth.setAuth(token, user)
    ↓
Save to IndexedDB (authStorage)
├─ token
├─ user
└─ Both persist across sessions
    ↓
Trigger: syncFromDatabase()
    ↓
FETCH ALL AUTHENTICATED DATA:
├─ GET /api/likes (liked tracks)
├─ GET /api/playlists (all playlists)
├─ GET /api/history (play history)
└─ GET /api/recommendations (personalized)
    ↓
MERGE WITH LOCAL CACHE:
├─ If same trackId exists:
│  ├─ Guest version: local like
│  └─ DB version: server like
│  └─ Merge: take DB version (source of truth)
└─ New items: add to Zustand store
    ↓
LOAD COMPLETE:
├─ User can access all cloud data
├─ Offline-first: local cache is fallback
└─ Subsequent actions sync to DB
    ↓
Logout:
├─ Remove auth from IndexedDB
├─ Keep local cache (guest mode again)
└─ Redirect to home
```

---

## Authentication Flow

### JWT Implementation

```
┌─────────────────────────────────────┐
│      FASTIFY-JWT FLOW               │
├─────────────────────────────────────┤

1. REGISTRATION/LOGIN
   Input: { email, password }
   ↓
   Backend: Hash password, store in DB
   ↓
   Create JWT:
   jwt.sign({
     id: user.id,
     email: user.email,
     username: user.username
   })
   ↓
   Return token to frontend
   ↓
   Token valid for: ∞ (until logout)

2. FRONTEND STORAGE
   Save JWT in IndexedDB:
   ├─ Persistent across sessions
   ├─ Lost only on logout
   └─ Send on every authenticated request

3. AUTHENTICATED REQUESTS
   Header: Authorization: Bearer {token}
   ↓
   Fastify-JWT middleware:
   ├─ Extract token
   ├─ Verify signature (SECRET_KEY)
   ├─ Extract payload (id, email, username)
   └─ Attach to request.user
   ↓
   Route handler:
   ├─ Access request.user.id
   ├─ Fetch user's own data
   └─ Prevent unauthorized access

4. ERROR HANDLING
   ├─ 401 Unauthorized: No/invalid token
   ├─ 403 Forbidden: Not owner/invalid permissions
   └─ 500 Server error: Database/unknown
```

### Protected Route Pattern

```typescript
// Backend Route Pattern:
fastify.get('/endpoint', {
  onRequest: [fastify.authenticate]  // <-- JWT verification
}, async (request, reply) => {
  const userId = (request.user as any).id;  // <-- Extracted from JWT
  
  // Fetch user-specific data
  const data = await prisma.model.findMany({
    where: { userId }
  });
  
  return { data };
});

// Frontend Call Pattern:
const token = useAuth.getState().token;
const response = await fetch(
  `${API_BASE}/endpoint`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);
```

---

## Caching & Performance

### Frontend Caching Strategy

```
┌──────────────────────────────────────┐
│    FRONTEND CACHE LAYERS             │
├──────────────────────────────────────┤

LAYER 1: ZUSTAND (Memory)
├─ Current playing track
├─ Queue (forward + reverse)
├─ Volume, progress, duration
├─ Liked tracks cache
├─ Player state (playing/paused/error)
└─ TTL: Runtime only (cleared on refresh)

LAYER 2: INDEXEDDB (Persistent)
├─ Guest playlists
├─ Guest liked tracks
├─ Guest queue history
├─ Lyrics cache (by artist-title)
├─ Discovered tracks
├─ Auth token + user data
└─ TTL: 30 days (auto-clear)

LAYER 3: API (Server)
├─ Source of truth when authenticated
├─ Lazy-load on demand
├─ Sync periodically
└─ TTL: Database

FETCH PRIORITY:
1. Check Zustand memory
2. Check IndexedDB
3. Fetch from API (if authenticated)
4. Cache result in both #1 and #2
5. Return to UI
```

### Backend Caching Strategy

```
┌──────────────────────────────────────┐
│    BACKEND CACHE/OPTIMIZATION        │
├──────────────────────────────────────┤

PRISMA CACHING:
├─ Accelerate extension (optional CDN)
├─ Query caching: cacheStrategy: { ttl: 60, swr: 30 }
└─ Example:
   ├─ Playlists: 60s TTL, 30s stale-while-revalidate
   └─ Recommendations: 300s TTL

POPULAR TRACKS CACHE:
├─ CachedPopularTracks table
├─ Aggregated weekly from all playlists
├─ Prevents expensive aggregation on each request
└─ API returns pre-computed popular lists

RECOMMENDATION SCORING:
├─ score: weighted by play count + recency
├─ lastPlayedAt: tracks played recently rank higher
├─ Aggregate queries optimized with GROUP BY

DATABASE INDEXES:
├─ userId: Fast user data lookup
├─ trackId: Popular track discovery
├─ status (invites): Quick pending invite fetch
├─ createdAt, updatedAt: Sort operations
└─ Composite indexes: (userId, trackId) for uniqueness
```

### API Response Optimization

```
┌──────────────────────────────────────┐
│    API OPTIMIZATION PATTERNS         │
├──────────────────────────────────────┤

1. PAGINATION
   GET /history?limit=50&offset=0
   ├─ Reduces payload size
   ├─ Faster initial load
   └─ User scrolls → load more

2. FIELD SELECTION
   GET /playlists/
   ├─ Return: id, name, _count.tracks
   ├─ NOT full track data
   └─ Reduce response size

3. LIMIT RESULTS
   GET /recommendations
   ├─ Recently: limit 10
   ├─ Most played: limit 10
   ├─ Top artists: limit 5 + 3 tracks each
   └─ Total ~50 items per response

4. ASYNC OPERATIONS
   - Recording play history: background
   - Popular cache update: weekly cron
   - Heavy aggregations: off-peak
```

---

## Key Design Decisions

### Why YouTube IFrame Only?
- ✅ Compliant with YouTube ToS
- ✅ No audio extraction/storage needed
- ✅ Official embedding with auth handling
- ✅ No CORS issues
- ❌ Cannot control playback like desktop player

### Why Dual Queue?
- ✅ Intuitive "previous" navigation
- ✅ Play history tracking
- ✅ Prevents infinite loops
- ✅ Matches Spotify/Apple Music UX

### Why IndexedDB for Guests?
- ✅ Persistent across sessions
- ✅ Offline capability
- ✅ No server overhead
- ✅ Privacy (data never leaves device)

### Why Blends?
- ✅ Social engagement
- ✅ Collaborative music discovery
- ✅ Invite-based (no random add)
- ✅ Shared playlist experience

---

## Development & Deployment

### Local Development
```bash
# Backend
cd vercel-serverless/backend
npm install
npm run dev              # Runs on :4001

# Frontend (separate terminal)
cd vercel-serverless/frontend
npm install
npm run dev             # Runs on :5173

# Environment
Create .env.local with VITE_API_URL=http://localhost:4001/api
```

### Production Deployment
```bash
# Frontend
- Build: npm run build → dist/
- Deploy to Vercel (auto-detect package.json)
- CDN caches static assets

# Backend
- Vercel detects api/index.ts
- Auto-wraps as serverless function
- PostgreSQL connection via DATABASE_URL
- JWT_SECRET from environment

# Database
- Managed PostgreSQL (supabase, vercel-postgres, etc.)
- Run migrations: npx prisma migrate deploy
```

---

## Future Enhancements

1. **WebSocket Real-time Sync** - Replace polling with WebSocket for invites
2. **Lyrics Display** - Integrated lyrics service (sync with playback)
3. **Advanced Search Filters** - Genre, year, duration filters
4. **Offline Mode** - Download playlists for offline play
5. **Social Features** - Follow users, view public profiles
6. **Recommendations AI** - Advanced ML-based recommendations
7. **Audio Normalization** - Consistent volume across tracks
8. **Visualizer** - Audio visualization during playback
9. **Dark/Light Theme** - Theme switching
10. **i18n Support** - Multi-language UI

---

## Troubleshooting

### Common Issues

**Issue**: "YouTube video not playing"
- Cause: Video not available in your region or removed
- Solution: Try different search result

**Issue**: "Auth token expired"
- Cause: Token is infinite but can be invalidated
- Solution: Log out and log back in

**Issue**: "Playlist tracks not syncing"
- Cause: Auth not established before sync
- Solution: Ensure login completes before operations

**Issue**: "IndexedDB quota exceeded"
- Cause: Too much data stored (guest mode)
- Solution: Clear cache or login to move to cloud

---

## Support & Contribution

- 📧 Email: akshayka@mamocollege.org
- 🐛 Report bugs via GitHub Issues
- 🚀 Feature requests welcome
- 👨‍💻 Pull requests appreciated

---

**Last Updated**: January 17, 2026
**Version**: 1.0.0
**Status**: Production Ready
