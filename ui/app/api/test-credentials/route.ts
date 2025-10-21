import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import twilio from 'twilio';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { openaiApiKey, twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = body;

    // Validate all fields are present
    if (!openaiApiKey || !twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      return NextResponse.json(
        { success: false, error: 'All credentials are required' },
        { status: 400 }
      );
    }

    const errors: string[] = [];

    // Test OpenAI API Key
    try {
      const openai = new OpenAI({ apiKey: openaiApiKey });
      // Make a simple API call to verify the key
      await openai.models.list();
    } catch (error: any) {
      errors.push(`OpenAI: ${error.message || 'Invalid API key'}`);
    }

    // Test Twilio Credentials
    try {
      const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
      // Verify credentials by fetching account info
      await twilioClient.api.accounts(twilioAccountSid).fetch();

      // Verify phone number exists and belongs to this account
      try {
        const phoneNumbers = await twilioClient.incomingPhoneNumbers.list({
          phoneNumber: twilioPhoneNumber,
          limit: 1
        });

        if (phoneNumbers.length === 0) {
          errors.push(`Twilio: Phone number ${twilioPhoneNumber} not found in your account`);
        }
      } catch (error: any) {
        errors.push(`Twilio: Could not verify phone number - ${error.message}`);
      }
    } catch (error: any) {
      errors.push(`Twilio: ${error.message || 'Invalid credentials'}`);
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: errors.join('; ') },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error testing credentials:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test credentials' },
      { status: 500 }
    );
  }
}
