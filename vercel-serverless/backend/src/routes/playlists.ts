import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { createPlaylistSchema, addToPlaylistSchema } from '../lib/validation.js';

export default async function playlistsRoutes(fastify: FastifyInstance) {
  // Get all user playlists
  fastify.get('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).id;
      const playlists = await prisma.playlist.findMany({
        where: { userId },
        include: {
          _count: {
            select: { tracks: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        cacheStrategy: { ttl: 60, swr: 30 }
      });

      return { playlists };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch playlists' };
    }
  });

  // Create playlist
  fastify.post('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const body = createPlaylistSchema.parse(request.body);
      const userId = (request.user as any).id;

      const playlist = await prisma.playlist.create({
        data: {
          userId,
          name: body.name,
          description: body.description,
          isPublic: body.isPublic,
        },
        include: {
          _count: {
            select: { tracks: true }
          }
        }
      });

      return { playlist };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        reply.code(400);
        return { error: 'Validation failed', details: error.errors };
      }
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to create playlist' };
    }
  });

  // Get playlist by ID
  fastify.get('/:id', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = (request.user as any).id;

      const playlist = await prisma.playlist.findFirst({
        where: {
          id,
          OR: [
            { userId },
            { isPublic: true }
          ]
        },
        include: {
          tracks: {
            orderBy: { position: 'asc' }
          },
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true
            }
          }
        },
        cacheStrategy: { ttl: 60, swr: 30 }
      });

      if (!playlist) {
        reply.code(404);
        return { error: 'Playlist not found' };
      }

      return { playlist };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch playlist' };
    }
  });

  // Add track to playlist
  fastify.post('/:id/tracks', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = addToPlaylistSchema.parse(request.body);
      const userId = (request.user as any).id;

      // Verify playlist ownership
      const playlist = await prisma.playlist.findFirst({
        where: { id, userId }
      });

      if (!playlist) {
        reply.code(404);
        return { error: 'Playlist not found' };
      }

      // Get current max position
      const maxPosition = await prisma.playlistTrack.findFirst({
        where: { playlistId: id },
        orderBy: { position: 'desc' },
        select: { position: true }
      });

      const track = await prisma.playlistTrack.create({
        data: {
          playlistId: id,
          trackId: body.trackId,
          title: body.title,
          artist: body.artist,
          thumbnail: body.thumbnail,
          duration: body.duration,
          position: (maxPosition?.position ?? -1) + 1
        }
      });

      return { track };
    } catch (error: any) {
      if (error.code === 'P2002') {
        reply.code(409);
        return { error: 'Track already in playlist' };
      }
      if (error.name === 'ZodError') {
        reply.code(400);
        return { error: 'Validation failed', details: error.errors };
      }
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to add track to playlist' };
    }
  });

  // Remove track from playlist
  fastify.delete('/:id/tracks/:trackId', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id, trackId } = request.params as { id: string; trackId: string };
      const userId = (request.user as any).id;

      // Verify playlist ownership
      const playlist = await prisma.playlist.findFirst({
        where: { id, userId }
      });

      if (!playlist) {
        reply.code(404);
        return { error: 'Playlist not found' };
      }

      await prisma.playlistTrack.delete({
        where: {
          playlistId_trackId: {
            playlistId: id,
            trackId
          }
        }
      });

      return { success: true };
    } catch (error: any) {
      if (error.code === 'P2025') {
        reply.code(404);
        return { error: 'Track not found in playlist' };
      }
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to remove track from playlist' };
    }
  });

  // Update playlist
  fastify.patch('/:id', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const userId = (request.user as any).id;

      const playlist = await prisma.playlist.update({
        where: {
          id,
          userId
        },
        data: {
          name: body.name,
          description: body.description,
          isPublic: body.isPublic,
        }
      });

      return { playlist };
    } catch (error: any) {
      if (error.code === 'P2025') {
        reply.code(404);
        return { error: 'Playlist not found' };
      }
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to update playlist' };
    }
  });

  // Delete playlist
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = (request.user as any).id;

      await prisma.playlist.delete({
        where: {
          id,
          userId
        }
      });

      return { success: true };
    } catch (error: any) {
      if (error.code === 'P2025') {
        reply.code(404);
        return { error: 'Playlist not found' };
      }
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to delete playlist' };
    }
  });
}
