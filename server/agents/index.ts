import { RealtimeAgent } from '@openai/agents/realtime';
import { OutboundTask, AgentConfig } from '../types/index.js';
import { createOutboundTaskAgent } from './outbound-task-agent.js';

export function getAgentForTask(task: OutboundTask, config?: AgentConfig): RealtimeAgent {
  return createOutboundTaskAgent(task, config);
}

export { createOutboundTaskAgent };
