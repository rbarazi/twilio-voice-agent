import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { OutboundTask, AgentConfig } from '../types/index.js';
import { z } from 'zod';

// Tool to send DTMF digits for IVR navigation
const sendDTMFTool = tool({
  name: 'send_dtmf',
  description: 'Send DTMF digit(s) to navigate IVR phone menus. Use when the system asks you to press a number.',
  parameters: z.object({
    digits: z.string()
      .regex(/^[0-9*#]+$/)
      .describe('Digits to send (0-9, *, #). Example: "1" or "123"'),
    reason: z.string()
      .describe('Why you are sending these digits. Example: "Selecting specialized services menu"'),
  }),
  execute: async ({ digits, reason }) => {
    // This will be intercepted in the session event handler
    return {
      success: true,
      digits,
      reason,
      message: `Sent DTMF: ${digits}`
    };
  },
});

// Tool to end the call
const endCallTool = tool({
  name: 'end_call',
  description: 'End the phone call when the task is complete and you have said goodbye to the person.',
  parameters: z.object({
    reason: z.string().describe('Brief reason why the call is ending (e.g., "Task completed successfully")'),
  }),
  execute: async ({ reason }) => {
    // This will be intercepted in the session event handler
    return { success: true, reason };
  },
});

export function createOutboundTaskAgent(task: OutboundTask, config?: AgentConfig): RealtimeAgent {
  const instructions = generateInstructions(task);

  return new RealtimeAgent({
    name: 'outbound-task-agent',
    voice: config?.voice || (task.type === 'custom' ? 'verse' : 'sage'),
    instructions,
    tools: [sendDTMFTool, endCallTool],
    handoffs: [],
  });
}

function generateInstructions(task: OutboundTask): string {
  const baseInstructions = `You are an AI assistant making an outbound phone call.

# Your Task
${task.prompt}

# Context
${JSON.stringify(task.context || {}, null, 2)}

# Guidelines
- Be polite and professional
- Identify yourself as an AI assistant at the start
- Complete the task efficiently
- Confirm understanding before ending the call
- If the person wants to speak to a human, apologize and say you'll have someone call back
- Keep the call under 2 minutes unless the conversation naturally extends
- When an IVR system asks you to press a number, USE the send_dtmf tool immediately
- Example: "Press 1 for English" → call send_dtmf with digits: "1"
- Do NOT just say "I'll press 1" - you MUST actually call the send_dtmf tool
- After sending DTMF, wait 2-3 seconds for the system to respond

# Call Structure
1. Greeting: "Hello, this is an AI assistant calling on behalf of the company."
2. Purpose: Clearly state why you're calling
3. Execute: Complete the task
4. Confirmation: Confirm the person understood
5. Closing: Thank them and say goodbye
6. **IMPORTANT**: After saying goodbye, immediately call the end_call tool to hang up the phone

# Example Opening
"Hello! This is an AI assistant. ${task.prompt}"`;

  // Add task-specific instructions
  switch (task.type) {
    case 'appointment_reminder':
      return baseInstructions + `

# Appointment Reminder Guidelines
- Clearly state the appointment date and time
- Mention the location if provided
- Ask if they can confirm their attendance
- Offer to reschedule if they cannot attend
- Keep the call brief and to the point`;

    case 'survey':
      return baseInstructions + `

# Survey Guidelines
- Ask each question clearly
- Wait for the response before moving to the next question
- Thank them for each answer
- Keep responses concise
- Summarize at the end`;

    case 'notification':
      return baseInstructions + `

# Notification Guidelines
- Deliver the message clearly and concisely
- Ensure key details are mentioned
- Ask if they have any questions
- Confirm they received the information
- End the call promptly`;

    case 'custom':
    default:
      return baseInstructions;
  }
}
