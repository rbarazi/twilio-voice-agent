import { FastifyInstance } from 'fastify';
import { logger } from '../utils/logger.js';

// Store active WebSocket connections for broadcasting events
const eventClients = new Set<any>();

export async function eventRoutes(fastify: FastifyInstance) {
  // WebSocket endpoint for real-time event streaming to UI
  fastify.get('/twilio/events', { websocket: true }, (socket) => {
    logger.info('UI client connected to event stream');

    eventClients.add(socket);

    socket.on('close', () => {
      logger.info('UI client disconnected from event stream');
      eventClients.delete(socket);
    });

    socket.on('error', (error) => {
      logger.error('Event stream error', { error: error.message });
      eventClients.delete(socket);
    });
  });
}

// Helper function to broadcast events to all connected UI clients
export function broadcastEvent(event: {
  type: string;
  callSid?: string | null;
  data: any;
}) {
  const message = JSON.stringify({
    ...event,
    timestamp: new Date().toISOString(),
  });

  eventClients.forEach((client) => {
    try {
      if (client.readyState === 1) { // OPEN
        client.send(message);
      }
    } catch (error) {
      logger.error('Failed to broadcast event', { error });
    }
  });
}
