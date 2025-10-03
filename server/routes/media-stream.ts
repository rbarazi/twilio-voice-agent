import { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { RealtimeSession } from '@openai/agents/realtime';
import { TwilioRealtimeTransportLayer } from '@openai/agents-extensions';
import { logger } from '../utils/logger.js';
import { getAgentForTask } from '../agents/index.js';
import { callManager } from '../services/call-manager.js';
import { broadcastEvent } from './events.js';
import { broadcastAudio, hasAudioListeners } from './audio-stream.js';
import { endCall } from '../services/twilio-client.js';

// Adapter to make Node.js ws WebSocket compatible with browser WebSocket API
function createBrowserStyleWebSocket(nodeSocket: WebSocket): any {
  return {
    send: (data: any) => nodeSocket.send(data),
    close: () => nodeSocket.close(),
    addEventListener: (event: string, handler: any) => {
      if (event === 'message') {
        nodeSocket.on('message', (data: Buffer) => {
          handler({ data });
        });
      } else if (event === 'close') {
        nodeSocket.on('close', handler);
      } else if (event === 'error') {
        nodeSocket.on('error', handler);
      }
    },
    removeEventListener: (event: string, handler: any) => {
      nodeSocket.off(event, handler);
    },
  };
}

export async function mediaStreamRoutes(fastify: FastifyInstance) {
  fastify.get('/twilio/media-stream', { websocket: true }, async (socket: WebSocket) => {
    logger.info('WebSocket connection established');

    let session: RealtimeSession | null = null;
    let callSid: string | null = null;
    let startMessage: Buffer | null = null;
    let functionCallMap: Map<string, string> = new Map(); // Map call_id to function name

    // Peek at first message to get call metadata
    const firstMessageHandler = async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.event === 'start') {
          // Store the start message to re-emit later
          startMessage = message;
          callSid = data.start.callSid;
          const streamSid = data.start.streamSid;
          logger.info('Media stream started', { callSid, streamSid });

          // Remove this one-time handler
          socket.off('message', firstMessageHandler);

          // Get call metadata
          const callMetadata = callSid ? callManager.getCall(callSid) : null;

          // Create agent with config
          const agent = callMetadata?.task
            ? getAgentForTask(callMetadata.task, callMetadata.agentConfig)
            : getAgentForTask({
                type: 'custom',
                prompt: 'You are a helpful AI assistant. Greet the caller and ask how you can help them.',
                context: {}
              });

          logger.info('Creating RealtimeSession...', { callSid, agentName: agent.name });

          try {
            // Verify API key
            if (!process.env.OPENAI_API_KEY) {
              throw new Error('OPENAI_API_KEY is not set');
            }

            // Create transport with browser-style WebSocket
            const browserSocket = createBrowserStyleWebSocket(socket);
            const transport = new TwilioRealtimeTransportLayer({
              twilioWebSocket: browserSocket,
            });

            // Create session with config
            const sessionConfig: any = {
              turnDetection: {
                type: 'server_vad',
              },
              inputAudioTranscription: {
                model: 'whisper-1',
              },
            };

            // Configure noise reduction
            // Default to 'far_field' for phone calls unless user specifies otherwise
            const noiseReductionMode = callMetadata?.agentConfig?.noiseReduction || 'far_field';
            if (noiseReductionMode !== 'off') {
              sessionConfig.inputAudioNoiseReduction = {
                type: noiseReductionMode,
              };
              logger.info('Enabling noise reduction', { callSid, mode: noiseReductionMode });
            } else {
              logger.info('Noise reduction disabled', { callSid });
            }

            // Add temperature if provided
            if (callMetadata?.agentConfig?.temperature !== undefined) {
              sessionConfig.temperature = Math.max(0.6, Math.min(1.2, callMetadata.agentConfig.temperature));
              logger.info('Setting temperature', { callSid, temperature: sessionConfig.temperature });
            }

            // Add voice if provided (voice is set on agent, not in session config)
            // Speed is not a direct API parameter - it needs to be in instructions

            // Use configured model or default to 'gpt-realtime'
            const model = callMetadata?.agentConfig?.model || 'gpt-realtime';
            logger.info('Creating session with model', { callSid, model });

            session = new RealtimeSession(agent, {
              transport,
              model,
              config: sessionConfig,
            });

            logger.info('RealtimeSession instance created', { callSid });

            // Add event handlers
            session.on('error', (error: any) => {
              logger.error('RealtimeSession error', {
                callSid,
                error: error.message || String(error),
                stack: error.stack,
                errorName: error.name,
                errorType: typeof error,
                errorKeys: error ? Object.keys(error) : [],
                errorJSON: error ? JSON.stringify(error, null, 2) : 'null'
              });
            });

            // session.on('connected', () => {
            //   logger.info('✅ RealtimeSession connected to OpenAI!', { callSid });
            // });

            // session.on('disconnected', () => {
            //   logger.info('RealtimeSession disconnected from OpenAI', { callSid });
            // });

            // Listen to session events
            session.on('transport_event', (event: any) => {
              // Track conversation items to map call_id to function name
              if (event.type === 'conversation.item.created') {
                if (event.item?.type === 'function_call') {
                  const callId = event.item.call_id;
                  const functionName = event.item.name;
                  if (callId && functionName) {
                    functionCallMap.set(callId, functionName);
                    logger.info('Function call initiated', {
                      callSid,
                      functionName,
                      callId
                    });
                  }
                }
              }

              // Log all function call related events for debugging
              if (event.type && event.type.includes('function_call')) {
                logger.info('Function call event', {
                  callSid,
                  eventType: event.type,
                  name: event.name,
                  call_id: event.call_id,
                  item_id: event.item_id,
                  arguments: event.arguments,
                  functionName: event.call_id ? functionCallMap.get(event.call_id) : undefined
                });
              }

              if (event.type === 'twilio_message') {
                if (event.message?.event === 'start') {
                  logger.info('Transport received start event', {
                    callSid: event.message.start.callSid,
                    streamSid: event.message.start.streamSid
                  });
                  broadcastEvent({
                    type: 'call.started',
                    callSid,
                    data: { streamSid: event.message.start.streamSid }
                  });
                } else if (event.message?.event === 'media') {
                  // Broadcast inbound audio (from user) if anyone is listening
                  if (callSid && hasAudioListeners(callSid)) {
                    broadcastAudio(callSid, {
                      source: 'inbound',
                      payload: event.message.media.payload,
                      codec: 'g711_ulaw'
                    });
                  }
                } else if (event.message?.event === 'stop') {
                  logger.info('Media stream stopped via transport', { callSid });
                  if (callSid) {
                    callManager.updateCallStatus(callSid, 'completed');
                    callManager.removeCall(callSid);
                  }
                  broadcastEvent({
                    type: 'call.ended',
                    callSid,
                    data: {}
                  });
                }
              } else if (event.type === 'response.audio.delta') {
                // Don't broadcast OpenAI audio - it's in PCM16 24kHz format
                // which is difficult to play in the browser alongside Twilio's μ-law 8kHz
                // The user can hear the AI voice through their phone
              } else if (event.type === 'response.audio_transcript.done') {
                logger.info('🗣️  AI said:', { callSid, transcript: event.transcript });
                broadcastEvent({
                  type: 'transcript.ai',
                  callSid,
                  data: { text: event.transcript }
                });
              } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
                logger.info('👤 User said:', { callSid, transcript: event.transcript });
                broadcastEvent({
                  type: 'transcript.user',
                  callSid,
                  data: { text: event.transcript }
                });
              } else if (event.type === 'response.function_call_arguments.done') {
                // Get function name from the map using call_id
                const functionName = event.call_id ? functionCallMap.get(event.call_id) : undefined;

                // Broadcast tool call to UI
                let parsedArgs;
                try {
                  parsedArgs = typeof event.arguments === 'string'
                    ? JSON.parse(event.arguments)
                    : event.arguments;
                } catch {
                  parsedArgs = {};
                }

                broadcastEvent({
                  type: 'tool.called',
                  callSid,
                  data: {
                    name: functionName,
                    arguments: parsedArgs
                  }
                });

                // Check if the AI is calling the end_call tool
                if (functionName === 'end_call' && callSid) {
                  const reason = parsedArgs?.reason || 'Task completed';
                  logger.info('🔚 AI requested to end call', {
                    callSid,
                    reason
                  });

                  // Broadcast to UI
                  broadcastEvent({
                    type: 'call.ending',
                    callSid,
                    data: { reason }
                  });

                  // End the call via Twilio API
                  endCall(callSid).then(() => {
                    logger.info('✅ Call ended successfully by AI', { callSid });
                  }).catch(error => {
                    logger.error('❌ Failed to end call from tool execution', {
                      callSid,
                      error: error instanceof Error ? error.message : String(error)
                    });
                  });
                }
              }
            });

            // Connect to OpenAI - this sets up transport's Twilio message listener
            logger.info('Calling session.connect()...', { callSid });
            await session.connect({
              apiKey: process.env.OPENAI_API_KEY,
            });
            logger.info('session.connect() completed', { callSid });

            // Now manually trigger the start event to the transport since we already consumed it
            // The transport's listener is now active, so we need to re-emit the start event
            if (startMessage) {
              logger.info('Re-emitting start message to transport', { callSid });
              socket.emit('message', startMessage);
            }

            // Update call status
            if (callMetadata && callSid) {
              callManager.updateCallStatus(callSid, 'in-progress');
            }

            logger.info('RealtimeSession setup complete', { callSid, agent: agent.name });
          } catch (error) {
            logger.error('Failed to create RealtimeSession', {
              callSid,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            });
          }
        }
      } catch (error) {
        logger.error('Error processing first message', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    socket.on('message', firstMessageHandler);

    socket.on('close', () => {
      logger.info('WebSocket connection closed', { callSid });
      session = null;

      if (callSid) {
        callManager.removeCall(callSid);
      }
    });

    socket.on('error', (error) => {
      logger.error('WebSocket error', { callSid, error: error.message });
    });
  });
}
