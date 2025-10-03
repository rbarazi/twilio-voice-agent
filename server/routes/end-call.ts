import { FastifyInstance } from 'fastify';
import { endCall } from '../services/twilio-client.js';
import { callManager } from '../services/call-manager.js';
import { logger } from '../utils/logger.js';

export async function endCallRoutes(fastify: FastifyInstance) {
  fastify.post('/twilio/end-call/:callSid', async (request, reply) => {
    const { callSid } = request.params as { callSid: string };

    try {
      logger.info('Ending call via API', { callSid });

      // End the call via Twilio
      await endCall(callSid);

      // Update call manager
      callManager.updateCallStatus(callSid, 'completed');
      callManager.removeCall(callSid);

      return {
        success: true,
        message: 'Call ended successfully',
        callSid,
      };
    } catch (error) {
      logger.error('Failed to end call', {
        callSid,
        error: error instanceof Error ? error.message : String(error),
      });

      reply.status(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to end call',
      };
    }
  });
}
