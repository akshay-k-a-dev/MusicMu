import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/auth.js';
import { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema } from '../lib/validation.js';

export default async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', async (request, reply) => {
    try {
      const body = registerSchema.parse(request.body);
      
      // Generate username from email if not provided
      const username = body.username || body.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') + '_' + Math.random().toString(36).substr(2, 4);
      
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: body.email },
            { username: username }
          ]
        }
      });

      if (existingUser) {
        reply.code(409);
        return { 
          error: existingUser.email === body.email 
            ? 'Email already registered' 
            : 'Username already taken' 
        };
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(body.password);
      const user = await prisma.user.create({
        data: {
          email: body.email,
          username: username,
          password: hashedPassword,
          name: body.name || username,
        },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          avatar: true,
          createdAt: true,
        }
      });

      // Generate JWT
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        username: user.username
      });

      return { user, token };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        reply.code(400);
        return { error: 'Validation failed', details: error.errors };
      }
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Registration failed' };
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);

      const user = await prisma.user.findUnique({
        where: { email: body.email }
      });

      if (!user) {
        reply.code(401);
        return { error: 'Invalid email or password' };
      }

      const isValidPassword = await verifyPassword(body.password, user.password);
      if (!isValidPassword) {
        reply.code(401);
        return { error: 'Invalid email or password' };
      }

      // Generate JWT
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        username: user.username
      });

      const { password: _, ...userWithoutPassword } = user;

      return { user: userWithoutPassword, token };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        reply.code(400);
        return { error: 'Validation failed', details: error.errors };
      }
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Login failed' };
    }
  });

  // Get current user (protected)
  fastify.get('/me', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: (request.user as any).id },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              likedTracks: true,
              playlists: true,
              playHistory: true
            }
          }
        },
        cacheStrategy: { ttl: 60, swr: 30 }
      });

      if (!user) {
        reply.code(404);
        return { error: 'User not found' };
      }

      return { user };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch user' };
    }
  });

  // Update profile (protected)
  fastify.patch('/me', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const body = updateProfileSchema.parse(request.body);
      const userId = (request.user as any).id;

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          name: body.name,
          username: body.username,
          avatar: body.avatar,
        },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          avatar: true,
          updatedAt: true,
        }
      });

      return { user };
    } catch (error: any) {
      if (error.code === 'P2002') {
        reply.code(409);
        return { error: 'Username already taken' };
      }
      if (error.name === 'ZodError') {
        reply.code(400);
        return { error: 'Validation failed', details: error.errors };
      }
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to update profile' };
    }
  });

  // Change password (protected)
  fastify.post('/change-password', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const body = changePasswordSchema.parse(request.body);
      const userId = (request.user as any).id;

      // Get current user with password
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true }
      });

      if (!user) {
        reply.code(404);
        return { error: 'User not found' };
      }

      // Verify current password
      const isValid = await verifyPassword(body.currentPassword, user.password);
      if (!isValid) {
        reply.code(401);
        return { error: 'Current password is incorrect' };
      }

      // Hash and update new password
      const hashedPassword = await hashPassword(body.newPassword);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      return { success: true, message: 'Password changed successfully' };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        reply.code(400);
        return { error: 'Validation failed', details: error.errors };
      }
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to change password' };
    }
  });
}
