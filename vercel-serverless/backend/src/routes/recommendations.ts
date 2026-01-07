import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

interface Track {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
}

interface TopArtist {
  name: string;
  playCount: number;
  tracks: Track[];
}

interface Recommendations {
  recentlyPlayed: Track[];
  mostPlayed: Track[];
  topArtists: TopArtist[];
}

export default async function recommendations(fastify: FastifyInstance) {
  // Get personalized recommendations for logged-in users
  fastify.get('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const userId = (request.user as any).id;

    // Get recently played (last 10 unique tracks)
    const recentPlays = await prisma.playHistory.findMany({
      where: { userId },
      orderBy: { playedAt: 'desc' },
      take: 50, // Get more to filter duplicates
      select: {
        trackId: true,
        title: true,
        artist: true,
        thumbnail: true,
      }
    });

    // Deduplicate by trackId
    const recentlyPlayedRaw = Array.from(
      new Map(recentPlays.map((p: any) => [p.trackId, {
        videoId: p.trackId,
        title: p.title,
        artist: p.artist,
        thumbnail: p.thumbnail || '',
        duration: 0 // Duration not stored in history
      }])).values()
    ).slice(0, 10);
    
    const recentlyPlayed: Track[] = recentlyPlayedRaw as Track[];

    // Get most played tracks (aggregate by trackId)
    const playCountsRaw = await prisma.playHistory.groupBy({
      by: ['trackId', 'title', 'artist', 'thumbnail'],
      where: { userId },
      _count: { trackId: true },
      orderBy: { _count: { trackId: 'desc' } },
      take: 10
    });

    const mostPlayed: Track[] = playCountsRaw.map((p: any) => ({
      videoId: p.trackId,
      title: p.title,
      artist: p.artist,
      thumbnail: p.thumbnail || '',
      duration: 0
    }));

    // Get top artists (aggregate by artist, get play count)
    const topArtistsRaw = await prisma.playHistory.groupBy({
      by: ['artist'],
      where: { userId },
      _count: { artist: true },
      orderBy: { _count: { artist: 'desc' } },
      take: 5
    });

    // For each top artist, get their tracks
    const topArtists: TopArtist[] = await Promise.all(
      topArtistsRaw.map(async (artistGroup: any) => {
        const tracks = await prisma.playHistory.findMany({
          where: {
            userId,
            artist: artistGroup.artist
          },
          orderBy: { playedAt: 'desc' },
          take: 20,
          select: {
            trackId: true,
            title: true,
            artist: true,
            thumbnail: true,
          }
        });

        // Deduplicate tracks by trackId
        const uniqueTracks = Array.from(
          new Map(tracks.map((t: any) => [t.trackId, {
            videoId: t.trackId,
            title: t.title,
            artist: t.artist,
            thumbnail: t.thumbnail || '',
            duration: 0
          }])).values()
        ).slice(0, 8); // Max 8 tracks per artist

        return {
          name: artistGroup.artist,
          playCount: artistGroup._count.artist,
          tracks: uniqueTracks
        };
      })
    );

    const recommendations: Recommendations = {
      recentlyPlayed,
      mostPlayed,
      topArtists
    };

    return { recommendations };
  });
}
