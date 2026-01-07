import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be at most 100 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/).optional(),
  avatar: z.string().url().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .max(100, 'Password must be at most 100 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
});

export const likeTrackSchema = z.object({
  trackId: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  thumbnail: z.string().optional(),
  duration: z.number().int().positive().optional(),
});

export const createPlaylistSchema = z.object({
  name: z.string().min(1, 'Playlist name is required').max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(false),
});

export const addToPlaylistSchema = z.object({
  trackId: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  thumbnail: z.string().optional(),
  duration: z.number().int().positive().optional(),
});

export const recordPlaySchema = z.object({
  trackId: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  thumbnail: z.string().optional(),
  duration: z.number().int().positive().optional(),
});
