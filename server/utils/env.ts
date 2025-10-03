export interface TwilioEnv {
  OPENAI_API_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
  PUBLIC_DOMAIN: string;
  TWILIO_SERVER_PORT: number;
}

export function validateEnv(): TwilioEnv {
  const required = [
    'OPENAI_API_KEY',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'PUBLIC_DOMAIN',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all Twilio configuration is set.'
    );
  }

  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID!,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN!,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER!,
    PUBLIC_DOMAIN: process.env.PUBLIC_DOMAIN!,
    TWILIO_SERVER_PORT: parseInt(process.env.TWILIO_SERVER_PORT || '5050', 10),
  };
}
