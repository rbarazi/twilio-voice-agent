import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import formbody from '@fastify/formbody';
import cors from '@fastify/cors';
import { validateEnv } from './utils/env.js';
import { logger } from './utils/logger.js';
import { healthRoutes } from './routes/health.js';
import { incomingCallRoutes } from './routes/incoming-call.js';
import { mediaStreamRoutes } from './routes/media-stream.js';
import { outboundCallRoutes } from './routes/outbound-call.js';
import { eventRoutes } from './routes/events.js';
import { audioStreamRoutes } from './routes/audio-stream.js';
import { endCallRoutes } from './routes/end-call.js';

async function start() {
  try {
    // Validate environment variables
    const env = validateEnv();
    logger.info('Environment validated successfully');

    // Create Fastify instance
    const fastify = Fastify({
      logger: false, // Use custom logger
    });

    // Register plugins
    await fastify.register(cors, {
      origin: true,
    });

    await fastify.register(formbody);

    await fastify.register(websocket, {
      options: {
        maxPayload: 1048576, // 1MB
      },
    });

    // Register routes
    await fastify.register(healthRoutes);
    await fastify.register(incomingCallRoutes);
    await fastify.register(mediaStreamRoutes);
    await fastify.register(outboundCallRoutes);
    await fastify.register(eventRoutes);
    await fastify.register(audioStreamRoutes);
    await fastify.register(endCallRoutes);

    // Error handler
    fastify.setErrorHandler((error, request, reply) => {
      logger.error('Request error', {
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
      });

      reply.code(500).send({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });

    // Start server
    const port = env.TWILIO_SERVER_PORT;
    await fastify.listen({ port, host: '0.0.0.0' });

    logger.info(`Twilio server listening on port ${port}`);
    logger.info(`Public domain: ${env.PUBLIC_DOMAIN}`);
    logger.info(`WebSocket endpoint: wss://${env.PUBLIC_DOMAIN}/twilio/media-stream`);
    logger.info(`Health check: https://${env.PUBLIC_DOMAIN}/twilio/health`);
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

start();
