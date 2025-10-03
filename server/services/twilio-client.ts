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
