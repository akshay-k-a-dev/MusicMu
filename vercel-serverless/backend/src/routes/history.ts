import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { recordPlaySchema } from '../lib/validation.js';

export default async function historyRoutes(fastify: FastifyInstance) {
  // Get play history
  fastify.get('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).id;
      const { limit = 50, offset = 0 } = request.query as any;

      const history = await prisma.playHistory.findMany({
        where: { userId },
        orderBy: { playedAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        cacheStrategy: { ttl: 30, swr: 15 }
      });

      return { history };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch play history' };
    }
  });

  // Record a play
  fastify.post('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const body = recordPlaySchema.parse(request.body);
      const userId = (request.user as any).id;

      // Update or create recommendation entry (this is the main aggregate)
      await prisma.recommendation.upsert({
        where: {
          userId_trackId: {
            userId,
            trackId: body.trackId
          }
        },
        update: {
          score: { increment: 0.5 }, // Each play adds +0.5 score
          playCount: { increment: 1 }, // Track play count
          lastPlayedAt: new Date(),
          source: 'play',
          updatedAt: new Date()
        },
        create: {
          userId,
          trackId: body.trackId,
          title: body.title,
          artist: body.artist,
          thumbnail: body.thumbnail,
          duration: body.duration,
          source: 'play',
          score: 1.0,
          playCount: 1,
          lastPlayedAt: new Date()
        }
      });

      // Create play history entry (keep limited history)
      const play = await prisma.playHistory.create({
        data: {
          userId,
          trackId: body.trackId,
          title: body.title,
          artist: body.artist,
          thumbnail: body.thumbnail,
          duration: body.duration,
        }
      });

      // Clean up old play history - keep only last 100 per user
      const historyCount = await prisma.playHistory.count({
        where: { userId }
      });

      if (historyCount > 100) {
        // Delete oldest entries beyond 100
        const oldestToKeep = await prisma.playHistory.findMany({
          where: { userId },
          orderBy: { playedAt: 'desc' },
          take: 100,
          select: { id: true }
        });

        const idsToKeep = oldestToKeep.map(h => h.id);

        await prisma.playHistory.deleteMany({
          where: {
            userId,
            id: { notIn: idsToKeep }
          }
        });
      }

      return { play };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        reply.code(400);
        return { error: 'Validation failed', details: error.errors };
      }
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to record play' };
    }
  });

  // Clear history
  fastify.delete('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).id;

      await prisma.playHistory.deleteMany({
        where: { userId }
      });

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to clear history' };
    }
  });
}
