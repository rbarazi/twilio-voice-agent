import twilio from 'twilio';
import { logger } from '../utils/logger.js';

let twilioClient: ReturnType<typeof twilio>;

function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  }
  return twilioClient;
}

export { getTwilioClient as twilioClient };

export interface CreateCallOptions {
  to: string;
  from?: string;
  url: string;
  method?: 'GET' | 'POST';
  statusCallback?: string;
  statusCallbackMethod?: 'GET' | 'POST';
}

export async function createCall(options: CreateCallOptions) {
  try {
    const client = getTwilioClient();
    const from = options.from || process.env.TWILIO_PHONE_NUMBER;
    if (!from) {
      throw new Error('TWILIO_PHONE_NUMBER is not set in environment variables');
    }

    const call = await client.calls.create({
      to: options.to,
      from,
      url: options.url,
      method: options.method || 'POST',
      statusCallback: options.statusCallback,
      statusCallbackMethod: options.statusCallbackMethod,
    });

    logger.info('Call created', { callSid: call.sid, to: options.to });
    return call;
  } catch (error) {
    logger.error('Failed to create call', error);
    throw error;
  }
}

export async function endCall(callSid: string) {
  try {
    const client = getTwilioClient();
    const call = await client.calls(callSid).update({ status: 'completed' });
    logger.info('Call ended', { callSid });
    return call;
  } catch (error) {
    logger.error('Failed to end call', { callSid, error });
    throw error;
  }
}

export async function sendDTMF(callSid: string, digits: string) {
  try {
    const client = getTwilioClient();
    const publicDomain = process.env.PUBLIC_DOMAIN;
    const protocol = publicDomain?.includes('localhost') ? 'ws' : 'wss';
    const streamUrl = `${protocol}://${publicDomain}/twilio/media-stream`;

    // Hybrid approach: Send DTMF then redirect back to Media Stream
    // This temporarily interrupts the Media Stream but allows DTMF to be sent
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play digits="${digits}"/>
    <Pause length="1"/>
    <Connect>
        <Stream url="${streamUrl}"/>
    </Connect>
</Response>`;

    const result = await client.calls(callSid).update({
      twiml: twiml
    });

    logger.info('DTMF sent with reconnect', { callSid, digits });
    return result;
  } catch (error) {
    logger.error('Failed to send DTMF', { callSid, digits, error });
    throw error;
  }
}
