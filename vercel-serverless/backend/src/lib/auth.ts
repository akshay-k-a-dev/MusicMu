import bcrypt from 'bcryptjs';
import { FastifyRequest } from 'fastify';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function extractToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

export async function getUserFromRequest(request: FastifyRequest): Promise<any> {
  try {
    await request.jwtVerify();
    return request.user;
  } catch (error) {
    return null;
  }
}
