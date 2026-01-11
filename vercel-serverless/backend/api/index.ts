import type { VercelRequest, VercelResponse } from '@vercel/node';
import app, { initializeApp } from '../src/index';

// Vercel serverless handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Initialize app (plugins, routes) - idempotent
    await initializeApp();
    await app.ready();
    
    // Use Fastify's inject method for serverless
    const response = await app.inject({
      method: req.method as any,
      url: req.url || '/',
      headers: req.headers as any,
      payload: req.body as any,
      query: req.query as any,
    });
    
    // Set response headers
    const headers = response.headers;
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        res.setHeader(key, value as string);
      }
    }
    
    // Send response
    res.status(response.statusCode).send(response.payload);
  } catch (error: any) {
    console.error('Serverless handler error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
