import { CallMetadata } from '../types/index.js';

class CallManager {
  private activeCalls: Map<string, CallMetadata> = new Map();

  addCall(metadata: CallMetadata): void {
    this.activeCalls.set(metadata.callSid, metadata);
  }

  getCall(callSid: string): CallMetadata | undefined {
    return this.activeCalls.get(callSid);
  }

  updateCallStatus(
    callSid: string,
    status: CallMetadata['status']
  ): void {
    const call = this.activeCalls.get(callSid);
    if (call) {
      call.status = status;
    }
  }

  removeCall(callSid: string): void {
    this.activeCalls.delete(callSid);
  }

  getActiveCalls(): CallMetadata[] {
    return Array.from(this.activeCalls.values());
  }

  getCallCount(): number {
    return this.activeCalls.size;
  }
}

export const callManager = new CallManager();
