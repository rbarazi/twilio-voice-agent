import { FastifyInstance } from 'fastify';
import { logger } from '../utils/logger.js';

export async function incomingCallRoutes(fastify: FastifyInstance) {
  fastify.post('/twilio/incoming-call', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const callSid = body.CallSid;
    const from = body.From;
    const to = body.To;

    logger.info('Incoming call', { callSid, from, to });

    const publicDomain = process.env.PUBLIC_DOMAIN;
    const protocol = publicDomain?.includes('localhost') ? 'ws' : 'wss';
    const streamUrl = `${protocol}://${publicDomain}/twilio/media-stream`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${streamUrl}"/>
    </Connect>
</Response>`;

    reply.type('text/xml').send(twiml);
  });
}
