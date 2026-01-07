import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { config } from 'dotenv';
import { search, getMetadata } from './lib/youtube.js';
import authRoutes from './routes/auth.js';
import likesRoutes from './routes/likes.js';
import playlistsRoutes from './routes/playlists.js';
import historyRoutes from './routes/history.js';
import recommendationsRoutes from './routes/recommendations.js';

// Load environment variables
config();

const PORT = parseInt(process.env.PORT || '4001');
const HOST = process.env.HOST || '0.0.0.0';

// Create Fastify app
const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});

// Register CORS
await app.register(cors, {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
});

// Register JWT
await app.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
});

// Add authentication decorator
app.decorate('authenticate', async function(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// Register authentication routes
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(likesRoutes, { prefix: '/api/likes' });
await app.register(playlistsRoutes, { prefix: '/api/playlists' });
await app.register(historyRoutes, { prefix: '/api/history' });
await app.register(recommendationsRoutes, { prefix: '/api/recommendations' });

// Root health endpoint (homepage)
app.get('/', async (request, reply) => {
  return {
    service: 'MusicMu Serverless Backend',
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    mode: 'fastify',
    endpoints: {
      health: '/api/health',
      search: '/api/search?q=query',
      guest: '/api/guest',
      track: '/api/track/:id',
      stream: '/api/track/:id/stream',
      full: '/api/track/:id/full',
      auth: {
        register: '/api/auth/register',
        login: '/api/auth/login',
        me: '/api/auth/me'
      },
      likes: '/api/likes',
      playlists: '/api/playlists',
      history: '/api/history'
    }
  };
});

// Health check
app.get('/api/health', async (request, reply) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'musicmu-serverless'
  };
});

// Search endpoint
app.get('/api/search', async (request, reply) => {
  const { q, limit } = request.query as { q?: string; limit?: string };
  
  if (!q) {
    reply.code(400);
    return { error: 'Missing search query parameter "q"' };
  }

  try {
    const resultLimit = limit ? parseInt(limit, 10) : 10;
    const results = await search(q, resultLimit);
    return { results };
  } catch (error: any) {
    request.log.error(error);
    reply.code(500);
    return { error: 'Search failed', message: error.message };
  }
});

// Guest session endpoint
app.get('/api/guest', async (request, reply) => {
  return {
    sessionId: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    expiresIn: 3600000,
    createdAt: new Date().toISOString()
  };
});

// Track metadata endpoint
app.get('/api/track/:id', async (request, reply) => {
  const { id } = request.params as { id: string };

  try {
    const metadata = await getMetadata(id);
    return metadata;
  } catch (error: any) {
    request.log.error(error);
    reply.code(404);
    return { error: 'Track not found', message: error.message };
  }
});

// Track streaming endpoint - iframe only
app.get('/api/track/:id/stream', async (request, reply) => {
  const { id } = request.params as { id: string };
  
  return {
    mode: 'iframe',
    url: `https://www.youtube.com/embed/${id}?autoplay=1&enablejsapi=1`
  };
});

// Full track info (metadata + stream)
app.get('/api/track/:id/full', async (request, reply) => {
  const { id } = request.params as { id: string };

  try {
    const metadata = await getMetadata(id);
    const stream = {
      mode: 'iframe',
      url: `https://www.youtube.com/embed/${id}?autoplay=1&enablejsapi=1`
    };

    return {
      metadata,
      stream
    };
  } catch (error: any) {
    request.log.error(error);
    reply.code(404);
    return { error: 'Track not found', message: error.message };
  }
});

// Start server (for local dev)
const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`\n🎵 MusicMu Serverless Backend`);
    console.log(`📡 Running on http://${HOST}:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🏠 Homepage: http://localhost:${PORT}/`);
    console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || '*'}\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Only start if running directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

// Export for Vercel
export default app;
