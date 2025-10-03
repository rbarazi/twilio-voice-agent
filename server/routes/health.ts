import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/twilio/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });
}
