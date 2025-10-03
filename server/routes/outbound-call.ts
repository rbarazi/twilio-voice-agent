import { FastifyInstance } from 'fastify';
import { OutboundCallRequest, OutboundCallResponse } from '../types/index.js';
import { callManager } from '../services/call-manager.js';
import { logger } from '../utils/logger.js';

export async function outboundCallRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: OutboundCallRequest }>(
    '/twilio/outbound-call',
    async (request, reply) => {
      try {
        const { to, task, agentConfig } = request.body;

        // Validation
        if (!to) {
          return reply.code(400).send({
            success: false,
            error: 'Missing required field: to',
            code: 'VALIDATION_ERROR',
          } as OutboundCallResponse);
        }

        if (!task || !task.type || !task.prompt) {
          return reply.code(400).send({
            success: false,
            error: 'Missing required field: task (must include type and prompt)',
            code: 'VALIDATION_ERROR',
          } as OutboundCallResponse);
        }

        // Validate phone number format (basic check)
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(to)) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid phone number format',
            code: 'INVALID_PHONE',
          } as OutboundCallResponse);
        }

        const publicDomain = process.env.PUBLIC_DOMAIN;
        const protocol = publicDomain?.includes('localhost') ? 'http' : 'https';
        const callbackUrl = `${protocol}://${publicDomain}/twilio/incoming-call`;

        // Import and create the call via Twilio
        const { createCall } = await import('../services/twilio-client.js');
        const call = await createCall({
          to,
          url: callbackUrl,
          method: 'POST',
        });

        // Store call metadata including agent config
        callManager.addCall({
          callSid: call.sid,
          to,
          task,
          agentConfig,
          startedAt: new Date(),
          status: 'initiated',
        });

        logger.info('Outbound call initiated', {
          callSid: call.sid,
          to,
          taskType: task.type,
        });

        return reply.send({
          success: true,
          callSid: call.sid,
          status: 'initiated',
          estimatedDuration: '60-120 seconds',
        } as OutboundCallResponse);
      } catch (error) {
        logger.error('Failed to initiate outbound call', error);

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'CALL_FAILED',
        } as OutboundCallResponse);
      }
    }
  );
}
