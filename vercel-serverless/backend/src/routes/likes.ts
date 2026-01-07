import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { likeTrackSchema } from '../lib/validation.js';

export default async function likesRoutes(fastify: FastifyInstance) {
  // Get all liked tracks
  fastify.get('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).id;
      const likedTracks = await prisma.likedTrack.findMany({
        where: { userId },
        orderBy: { likedAt: 'desc' },
        cacheStrategy: { ttl: 60, swr: 30 }
      });

      return { likedTracks };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch liked tracks' };
    }
  });

  // Like a track
  fastify.post('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const body = likeTrackSchema.parse(request.body);
      const userId = (request.user as any).id;

      // Create liked track
      const likedTrack = await prisma.likedTrack.create({
        data: {
          userId,
          trackId: body.trackId,
          title: body.title,
          artist: body.artist,
          thumbnail: body.thumbnail,
          duration: body.duration,
        }
      });

      // Update or create recommendation entry
      await prisma.recommendation.upsert({
        where: {
          userId_trackId: {
            userId,
            trackId: body.trackId
          }
        },
        update: {
          score: { increment: 2.0 }, // Liked tracks get +2 score
          isLiked: true,
          likedAt: new Date(),
          source: 'like',
          updatedAt: new Date()
        },
        create: {
          userId,
          trackId: body.trackId,
          title: body.title,
          artist: body.artist,
          thumbnail: body.thumbnail,
          duration: body.duration,
          source: 'like',
          score: 3.0, // Start with higher score for liked tracks
          isLiked: true,
          likedAt: new Date(),
          playCount: 0
        }
      });

      return { likedTrack };
    } catch (error: any) {
      if (error.code === 'P2002') {
        reply.code(409);
        return { error: 'Track already liked' };
      }
      if (error.name === 'ZodError') {
        reply.code(400);
        return { error: 'Validation failed', details: error.errors };
      }
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to like track' };
    }
  });

  // Unlike a track
  fastify.delete('/:trackId', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { trackId } = request.params as { trackId: string };
      const userId = (request.user as any).id;

      // Delete from liked tracks
      await prisma.likedTrack.delete({
        where: {
          userId_trackId: {
            userId,
            trackId
          }
        }
      });

      // Update recommendation to mark as unliked
      await prisma.recommendation.updateMany({
        where: {
          userId,
          trackId
        },
        data: {
          isLiked: false,
          likedAt: null,
          score: { decrement: 2.0 } // Remove the like bonus
        }
      });

      return { success: true };
    } catch (error: any) {
      if (error.code === 'P2025') {
        reply.code(404);
        return { error: 'Liked track not found' };
      }
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to unlike track' };
    }
  });

  // Check if track is liked
  fastify.get('/:trackId', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { trackId } = request.params as { trackId: string };
      const userId = (request.user as any).id;

      const liked = await prisma.likedTrack.findUnique({
        where: {
          userId_trackId: {
            userId,
            trackId
          }
        },
        cacheStrategy: { ttl: 60, swr: 30 }
      });

      return { isLiked: !!liked };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to check liked status' };
    }
  });
}
