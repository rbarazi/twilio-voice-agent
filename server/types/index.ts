export interface OutboundTask {
  type: 'appointment_reminder' | 'survey' | 'notification' | 'custom';
  prompt: string;
  context?: Record<string, unknown>;
}

export interface AgentConfig {
  voice?: string;
  temperature?: number;
  noiseReduction?: 'near_field' | 'far_field' | 'off';
  model?: string;
}

export interface UserCredentials {
  openaiApiKey?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
}

export interface OutboundCallRequest {
  to: string;
  task: OutboundTask;
  agentConfig?: AgentConfig;
  userCredentials?: UserCredentials;
}

export interface OutboundCallResponse {
  success: boolean;
  callSid?: string;
  status?: string;
  estimatedDuration?: string;
  error?: string;
  code?: string;
}

export interface CallMetadata {
  callSid: string;
  to: string;
  task: OutboundTask;
  agentConfig?: AgentConfig;
  userCredentials?: UserCredentials;
  startedAt: Date;
  status: 'initiated' | 'in-progress' | 'completed' | 'failed';
}
