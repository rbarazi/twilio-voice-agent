import { FastifyInstance } from 'fastify';
import { logger } from '../utils/logger.js';

// Store active audio stream connections per call
const audioStreamClients = new Map<string, Set<any>>();

export async function audioStreamRoutes(fastify: FastifyInstance) {
  // WebSocket endpoint for audio streaming to UI
  fastify.get('/twilio/audio-stream/:callSid', { websocket: true }, (socket, req) => {
    const callSid = (req.params as any).callSid;
    logger.info('Audio stream client connected', { callSid });

    // Add client to the set for this call
    if (!audioStreamClients.has(callSid)) {
      audioStreamClients.set(callSid, new Set());
    }
    audioStreamClients.get(callSid)!.add(socket);

    socket.on('close', () => {
      logger.info('Audio stream client disconnected', { callSid });
      const clients = audioStreamClients.get(callSid);
      if (clients) {
        clients.delete(socket);
        if (clients.size === 0) {
          audioStreamClients.delete(callSid);
        }
      }
    });

    socket.on('error', (error) => {
      logger.error('Audio stream error', { callSid, error: error.message });
      const clients = audioStreamClients.get(callSid);
      if (clients) {
        clients.delete(socket);
      }
    });
  });
}

// Helper function to broadcast audio to all listening clients for a call
export function broadcastAudio(callSid: string, audioData: {
  source: 'inbound' | 'outbound'; // inbound = user, outbound = AI
  payload: string; // base64 audio
  codec?: string;
}) {
  const clients = audioStreamClients.get(callSid);
  if (!clients || clients.size === 0) {
    return;
  }

  const message = JSON.stringify({
    type: 'audio',
    ...audioData,
    timestamp: new Date().toISOString(),
  });

  clients.forEach((client) => {
    try {
      if (client.readyState === 1) { // OPEN
        client.send(message);
      }
    } catch (error) {
      logger.error('Failed to broadcast audio', { callSid, error });
    }
  });
}

// Helper to check if anyone is listening
export function hasAudioListeners(callSid: string): boolean {
  const clients = audioStreamClients.get(callSid);
  return clients ? clients.size > 0 : false;
}
