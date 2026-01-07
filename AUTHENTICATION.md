# MusicMu Authentication System

## Overview

MusicMu now includes a complete authentication system with user registration, login, and cloud data synchronization using Prisma ORM with PostgreSQL (via Prisma Accelerate).

## Features

### ✅ User Authentication
- **Registration**: Create new accounts with email and password
- **Login**: Secure JWT-based authentication
- **Profile Management**: Update name and password
- **Session Persistence**: Automatic token storage and refresh

### ✅ Cloud Data Sync
- **Liked Songs**: Sync liked tracks across devices
- **Playlists**: Create and manage playlists with full CRUD operations
- **Play History**: Track what you've listened to
- **Real-time Sync**: Changes sync instantly to the cloud

### ✅ Offline Support
- Works with or without an account (Guest Mode)
- Local storage fallback when not authenticated
- Seamless transition between guest and authenticated states

## Architecture

### Backend (Vercel Serverless)

**Database**: PostgreSQL via Prisma Accelerate
- Connection pooling enabled
- Query caching for performance
- Automatic migrations

**Authentication**: JWT-based with bcrypt password hashing
- Tokens stored securely in localStorage
- Automatic token validation on API calls
- 401 handling with automatic logout

**API Routes**:
```
POST   /api/auth/register     - Create new account
POST   /api/auth/login        - Login to existing account
GET    /api/auth/me           - Get current user (protected)
PATCH  /api/auth/me           - Update profile (protected)

GET    /api/likes             - Get all liked tracks (protected)
POST   /api/likes             - Add a liked track (protected)
DELETE /api/likes/:trackId    - Remove a liked track (protected)
GET    /api/likes/:trackId    - Check if track is liked (protected)

GET    /api/playlists         - Get all playlists (protected)
POST   /api/playlists         - Create new playlist (protected)
GET    /api/playlists/:id     - Get playlist details (protected)
PATCH  /api/playlists/:id     - Update playlist (protected)
DELETE /api/playlists/:id     - Delete playlist (protected)
POST   /api/playlists/:id/tracks        - Add track to playlist (protected)
DELETE /api/playlists/:id/tracks/:trackId - Remove track from playlist (protected)

GET    /api/history           - Get play history (protected)
POST   /api/history           - Add to play history (protected)
DELETE /api/history/:id       - Delete history entry (protected)
```

### Frontend (React + TypeScript)

**State Management**:
- `useAuth` store: Authentication state (token, user, login, logout)
- `usePlayer` store: Player state with automatic cloud sync

**Components**:
- `LoginPage`: Email/password login form
- `RegisterPage`: Account creation with validation
- `ProfilePage`: Update name and password, view account details

**API Integration**:
- `api.ts`: Centralized API client with automatic auth headers
- Automatic token refresh on 401 responses
- Offline-first with local cache fallback

## Database Schema

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // bcrypt hashed
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  likedTracks  LikedTrack[]
  playlists    Playlist[]
  playHistory  PlayHistory[]
}

model LikedTrack {
  id        String   @id @default(cuid())
  userId    String
  trackId   String
  title     String
  artist    String
  thumbnail String
  duration  Int
  createdAt DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, trackId])
  @@index([userId])
}

model Playlist {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user   User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  tracks PlaylistTrack[]
  
  @@index([userId])
}

model PlaylistTrack {
  id         String   @id @default(cuid())
  playlistId String
  trackId    String
  title      String
  artist     String
  thumbnail  String
  duration   Int
  position   Int
  addedAt    DateTime @default(now())
  
  playlist Playlist @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  
  @@unique([playlistId, trackId])
  @@index([playlistId])
}

model PlayHistory {
  id        String   @id @default(cuid())
  userId    String
  trackId   String
  title     String
  artist    String
  thumbnail String
  duration  Int
  playedAt  DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([playedAt])
}
```

## Setup Instructions

### 1. Environment Variables

Create `/vercel-serverless/backend/.env`:

```env
# Prisma Accelerate connection (for serverless with connection pooling)
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"

# Direct connection (for migrations)
DIRECT_DATABASE_URL="postgresql://username:password@host:5432/database?sslmode=require"

# JWT secret (generate a random string)
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
```

### 2. Database Migration

```bash
cd vercel-serverless/backend
npx prisma db push
```

### 3. Start Backend

```bash
cd vercel-serverless/backend
npm run dev
```

The backend will start on `http://localhost:4001`

### 4. Start Frontend

```bash
cd client
npm run dev
```

The frontend will start on `http://localhost:5173`

## Usage

### Guest Mode (No Account)
- Browse and play music
- Like songs (stored locally)
- Create queue
- Data saved in browser localStorage

### Authenticated Mode (With Account)
1. Click "Sign In" in the sidebar or mobile nav
2. Create an account or login
3. All data now syncs to the cloud
4. Access your music from any device

### Creating an Account
1. Navigate to `/register`
2. Enter email, password (min 6 chars), and optional name
3. Account is created and you're automatically logged in
4. Local liked songs remain available

### Syncing Data
- Liked songs automatically sync when you like/unlike
- Play history tracks every song you play
- Playlists sync in real-time
- Works seamlessly with offline-first approach

## Security Features

- ✅ Passwords hashed with bcrypt (10 rounds)
- ✅ JWT tokens with expiration
- ✅ SQL injection protection (Prisma ORM)
- ✅ CORS configuration
- ✅ Input validation with Zod schemas
- ✅ Protected API routes require authentication
- ✅ Automatic logout on invalid tokens

## Performance Optimizations

- **Prisma Accelerate**: Connection pooling + query caching
- **Instant UI feedback**: Local updates before API calls
- **Background sync**: API calls don't block UI
- **Fallback to local cache**: Works even when backend is down
- **Efficient queries**: Indexed database fields for fast lookups

## Development Tips

### Testing Authentication

```bash
# Register a new user
curl -X POST http://localhost:4001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'

# Login
curl -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Get user profile (use token from login response)
curl http://localhost:4001/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Database Management

```bash
# Open Prisma Studio (GUI for database)
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Generate Prisma Client after schema changes
npx prisma generate
```

## Deployment

### Backend (Vercel)

1. Set environment variables in Vercel dashboard:
   - `DATABASE_URL`
   - `DIRECT_DATABASE_URL`
   - `JWT_SECRET`

2. Deploy:
```bash
cd vercel-serverless/backend
vercel deploy --prod
```

### Frontend (Vercel)

1. Set environment variable:
   - `VITE_API_URL=https://your-backend.vercel.app`

2. Deploy:
```bash
cd client
vercel deploy --prod
```

## Troubleshooting

### Backend won't start
- Check `.env` file exists with correct values
- Run `npm install` to ensure dependencies are installed
- Run `npx prisma generate` to regenerate Prisma Client

### Authentication not working
- Check JWT_SECRET is set in `.env`
- Verify DATABASE_URL is correct
- Check browser console for errors
- Clear localStorage and try again

### Data not syncing
- Check network requests in browser DevTools
- Verify backend is running and accessible
- Check if user is authenticated (token in localStorage)
- Look for errors in backend logs

## Future Enhancements

- [ ] Email verification
- [ ] Password reset via email
- [ ] OAuth providers (Google, GitHub)
- [ ] Public playlists and sharing
- [ ] Collaborative playlists
- [ ] Social features (follow users, activity feed)
- [ ] Advanced analytics (listening stats, trends)
- [ ] Export/import playlists

## License

Same as MusicMu project (see root LICENSE file)
