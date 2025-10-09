import { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { RealtimeSession } from '@openai/agents/realtime';
import { TwilioRealtimeTransportLayer } from '@openai/agents-extensions';
import { logger } from '../utils/logger.js';
import { getAgentForTask } from '../agents/index.js';
import { callManager } from '../services/call-manager.js';
import { broadcastEvent } from './events.js';
import { broadcastAudio, hasAudioListeners } from './audio-stream.js';
import { endCall, sendDTMF } from '../services/twilio-client.js';

// Global map to store conversation history by callSid
interface ConversationHistory {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  lastUpdated: Date;
}
const conversationHistories = new Map<string, ConversationHistory>();

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
    let streamSid: string | null = null;
    let startMessage: Buffer | null = null;
    let functionCallMap: Map<string, string> = new Map(); // Map call_id to function name
    let pendingEndCall: { callSid: string; reason: string } | null = null; // Track pending end_call request
    let lastAudioTranscriptTime: number | null = null; // Track last audio completion time

    // Interruption handling state
    let latestMediaTimestamp: number = 0; // Current position in Twilio stream (ms)
    let responseStartTimestampTwilio: number | null = null; // When AI started speaking (ms)
    let lastAssistantItem: string | null = null; // Current response item_id from OpenAI

    // Peek at first message to get call metadata
    const firstMessageHandler = async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.event === 'start') {
          // Store the start message to re-emit later
          startMessage = message;
          callSid = data.start.callSid;
          streamSid = data.start.streamSid;
          logger.info('Media stream started', { callSid, streamSid });

          // Remove this one-time handler
          socket.off('message', firstMessageHandler);

          // Get call metadata
          const callMetadata = callSid ? callManager.getCall(callSid) : null;

          logger.info('📋 Call metadata retrieved', {
            callSid,
            hasMetadata: !!callMetadata,
            hasTask: !!callMetadata?.task,
            taskType: callMetadata?.task?.type,
            taskPromptLength: callMetadata?.task?.prompt?.length
          });

          // Check if this is a reconnection (conversation history exists)
          const history = callSid ? conversationHistories.get(callSid) : null;
          const isReconnection = history && history.messages.length > 0;

          if (isReconnection) {
            logger.info('🔄 Reconnecting stream with conversation history', {
              callSid,
              messageCount: history.messages.length,
              messages: history.messages.map(m => `${m.role}: ${m.content.substring(0, 30)}...`)
            });
          }

          // Create agent with config, adding conversation context if reconnecting
          let task = callMetadata?.task || {
            type: 'custom' as const,
            prompt: 'You are a helpful AI assistant. Greet the caller and ask how you can help them.',
            context: {}
          };

          logger.info('📋 Using task', {
            callSid,
            taskType: task.type,
            promptLength: task.prompt.length,
            promptPreview: task.prompt.substring(0, 100)
          });

          // If reconnecting, add conversation history to the prompt
          if (isReconnection && history) {
            const conversationSummary = history.messages
              .map(m => `${m.role === 'user' ? 'User' : 'You'}: ${m.content}`)
              .join('\n');

            const newPrompt = `${task.prompt}

# Previous Conversation (before brief disconnect)
${conversationSummary}

# Instructions
Continue the conversation naturally from where it left off. You were in the middle of helping with: ${task.prompt}`;

            logger.info('📝 Injecting conversation history into prompt', {
              callSid,
              originalPromptLength: task.prompt.length,
              newPromptLength: newPrompt.length,
              historyMessageCount: history.messages.length
            });

            task = {
              ...task,
              prompt: newPrompt,
              context: {
                ...task.context,
                reconnection: true,
                previousMessages: history.messages.length
              }
            };
          }

          const agent = getAgentForTask(task, callMetadata?.agentConfig);

          // Initialize or update conversation history
          if (callSid) {
            if (!history) {
              conversationHistories.set(callSid, {
                messages: [],
                lastUpdated: new Date()
              });
              logger.info('📝 Initialized conversation history', { callSid });
            } else {
              // Update lastUpdated to indicate reconnection
              history.lastUpdated = new Date();
              logger.info('📝 Updated history timestamp for reconnection', { callSid });
            }
          }

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
              // Handle user interruptions - cancel AI response when user starts speaking
              if (event.type === 'input_audio_buffer.speech_started') {
                logger.info('🎤 User started speaking (potential interruption)', { callSid });

                // Only handle interruption if AI was actually speaking
                if (responseStartTimestampTwilio != null && lastAssistantItem) {
                  // Calculate how much audio the user heard
                  const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;

                  logger.info('🔪 Truncating AI response', {
                    callSid,
                    item_id: lastAssistantItem,
                    audio_heard_ms: elapsedTime,
                    start_timestamp: responseStartTimestampTwilio,
                    current_timestamp: latestMediaTimestamp
                  });

                  // Send truncate event to OpenAI to update conversation history
                  try {
                    const truncateEvent = {
                      type: 'conversation.item.truncate' as const,
                      item_id: lastAssistantItem,
                      content_index: 0,
                      audio_end_ms: elapsedTime
                    };

                    // Access transport to send raw event
                    session?.transport.sendEvent(truncateEvent as any);
                    logger.info('✂️  Sent truncate event to OpenAI', {
                      callSid,
                      item_id: lastAssistantItem,
                      audio_end_ms: elapsedTime
                    });
                  } catch (error) {
                    logger.error('Failed to send truncate event', {
                      callSid,
                      error: error instanceof Error ? error.message : String(error)
                    });
                  }

                  // Cancel any ongoing AI response generation
                  try {
                    session?.interrupt();
                    logger.info('🚫 Interrupted AI response generation', { callSid });
                  } catch (error) {
                    logger.warn('Could not interrupt response', {
                      callSid,
                      error: error instanceof Error ? error.message : String(error)
                    });
                  }

                  // Clear Twilio's audio buffer to stop playback immediately
                  if (streamSid) {
                    try {
                      socket.send(JSON.stringify({
                        event: 'clear',
                        streamSid: streamSid
                      }));
                      logger.info('🧹 Cleared Twilio audio buffer', { callSid, streamSid });
                    } catch (error) {
                      logger.error('Failed to clear Twilio buffer', {
                        callSid,
                        error: error instanceof Error ? error.message : String(error)
                      });
                    }
                  }

                  // Reset interruption tracking state
                  responseStartTimestampTwilio = null;
                  lastAssistantItem = null;

                  // Broadcast interruption event to UI
                  broadcastEvent({
                    type: 'conversation.interrupted',
                    callSid,
                    data: {
                      reason: 'User started speaking',
                      audioHeardMs: elapsedTime
                    }
                  });
                } else {
                  // User started speaking but AI wasn't speaking - just log it
                  logger.debug('User started speaking (AI was not speaking)', { callSid });
                }
              }

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
                  // Track current timestamp for interruption handling
                  if (event.message.media?.timestamp) {
                    latestMediaTimestamp = event.message.media.timestamp;
                  }

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

                  // Don't clean up immediately - the stream might reconnect (e.g., after DTMF)
                  // Set a timeout to clean up only if no reconnection happens
                  if (callSid) {
                    setTimeout(() => {
                      // Check if a new stream has started for this call
                      const callStillExists = callManager.getCall(callSid);
                      const history = conversationHistories.get(callSid);

                      // Only clean up if no recent activity (no reconnection)
                      if (history) {
                        const timeSinceUpdate = Date.now() - history.lastUpdated.getTime();
                        if (timeSinceUpdate > 3000) {
                          // No activity for 3 seconds, safe to clean up
                          callManager.updateCallStatus(callSid, 'completed');
                          callManager.removeCall(callSid);
                          conversationHistories.delete(callSid);
                          logger.info('Cleaned up conversation history after timeout', { callSid });

                          broadcastEvent({
                            type: 'call.ended',
                            callSid,
                            data: {}
                          });
                        } else {
                          logger.info('Stream reconnected, preserving history', { callSid, timeSinceUpdate });
                        }
                      }
                    }, 3500); // Wait 3.5 seconds before cleanup
                  }
                }
              } else if (event.type === 'response.audio.delta') {
                // Track when AI starts speaking for interruption handling
                if (!responseStartTimestampTwilio) {
                  responseStartTimestampTwilio = latestMediaTimestamp;
                  logger.info('🎙️ AI started speaking', {
                    callSid,
                    timestamp: responseStartTimestampTwilio,
                    item_id: event.item_id
                  });
                }

                // Track which response item is currently playing
                if (event.item_id) {
                  lastAssistantItem = event.item_id;
                }

                // Don't broadcast OpenAI audio - it's in PCM16 24kHz format
                // which is difficult to play in the browser alongside Twilio's μ-law 8kHz
                // The user can hear the AI voice through their phone
              } else if (event.type === 'response.audio_transcript.done') {
                logger.info('🗣️  AI said:', { callSid, transcript: event.transcript });
                lastAudioTranscriptTime = Date.now();

                // Track conversation history
                if (callSid && event.transcript) {
                  const history = conversationHistories.get(callSid);
                  if (history) {
                    history.messages.push({
                      role: 'assistant',
                      content: event.transcript
                    });
                    history.lastUpdated = new Date();
                    logger.info('📝 Added AI message to history', {
                      callSid,
                      messageCount: history.messages.length,
                      transcript: event.transcript.substring(0, 50)
                    });
                  } else {
                    logger.warn('⚠️  No history found for AI message', { callSid });
                  }
                }

                broadcastEvent({
                  type: 'transcript.ai',
                  callSid,
                  data: { text: event.transcript }
                });

                // Reset interruption tracking state - AI finished speaking naturally
                responseStartTimestampTwilio = null;
                lastAssistantItem = null;

                // If end_call is pending, execute after audio is done
                if (pendingEndCall && pendingEndCall.callSid === callSid) {
                  logger.info('⏳ Audio transcript done, ending call after buffer', {
                    callSid,
                    reason: pendingEndCall.reason
                  });

                  // Add 500ms buffer for audio transmission and playback
                  setTimeout(() => {
                    if (pendingEndCall && pendingEndCall.callSid === callSid) {
                      endCall(callSid).then(() => {
                        logger.info('✅ Call ended successfully after audio completion', { callSid });
                        pendingEndCall = null;
                      }).catch(error => {
                        logger.error('❌ Failed to end call after audio completion', {
                          callSid,
                          error: error instanceof Error ? error.message : String(error)
                        });
                        pendingEndCall = null;
                      });
                    }
                  }, 500);
                }
              } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
                logger.info('👤 User said:', { callSid, transcript: event.transcript });

                // Track conversation history
                if (callSid && event.transcript) {
                  const history = conversationHistories.get(callSid);
                  if (history) {
                    history.messages.push({
                      role: 'user',
                      content: event.transcript
                    });
                    history.lastUpdated = new Date();
                    logger.info('📝 Added user message to history', {
                      callSid,
                      messageCount: history.messages.length,
                      transcript: event.transcript.substring(0, 50)
                    });
                  } else {
                    logger.warn('⚠️  No history found for user message', { callSid });
                  }
                }

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

                // Check if the AI is calling the send_dtmf tool
                if (functionName === 'send_dtmf' && callSid) {
                  const digits = parsedArgs?.digits || '';
                  const reason = parsedArgs?.reason || 'IVR navigation';
                  logger.info('🔢 AI requested DTMF', {
                    callSid,
                    digits,
                    reason
                  });

                  // Broadcast to UI
                  broadcastEvent({
                    type: 'dtmf.sent',
                    callSid,
                    data: { digits, reason }
                  });

                  // Send DTMF via Twilio API
                  // This will temporarily interrupt the Media Stream, send DTMF, then reconnect
                  sendDTMF(callSid, digits).then(() => {
                    logger.info('✅ DTMF sent successfully, stream will reconnect', { callSid, digits });
                  }).catch(error => {
                    logger.error('❌ Failed to send DTMF', {
                      callSid,
                      digits,
                      error: error instanceof Error ? error.message : String(error)
                    });
                  });
                }

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

                  // Mark end_call as pending - will execute after next audio_transcript.done
                  pendingEndCall = { callSid, reason };
                  logger.info('⏸️  End call pending - waiting for audio to complete', { callSid });

                  // Fallback timeout: if no audio_transcript.done event within 10 seconds, end anyway
                  setTimeout(() => {
                    if (pendingEndCall && pendingEndCall.callSid === callSid) {
                      logger.warn('⚠️  Timeout waiting for audio completion, ending call now', { callSid });
                      endCall(callSid).then(() => {
                        logger.info('✅ Call ended via timeout fallback', { callSid });
                        pendingEndCall = null;
                      }).catch(error => {
                        logger.error('❌ Failed to end call via timeout', {
                          callSid,
                          error: error instanceof Error ? error.message : String(error)
                        });
                        pendingEndCall = null;
                      });
                    }
                  }, 10000);
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

      // Don't immediately remove call metadata - it might reconnect after DTMF
      // Cleanup is handled by the timeout in the 'stop' event handler
    });

    socket.on('error', (error) => {
      logger.error('WebSocket error', { callSid, error: error.message });
    });
  });
}
