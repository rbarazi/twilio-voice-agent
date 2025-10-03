"use client";

import { useState, useRef, useEffect } from "react";

interface TranscriptItem {
  timestamp: string;
  speaker: "ai" | "user";
  text: string;
}

interface ToolCall {
  timestamp: string;
  name: string;
  arguments: Record<string, any>;
}

interface ModelInfo {
  id: string;
  created: number;
  owned_by: string;
  description?: string;
}

export default function TwilioPage() {
  const [phoneNumber, setPhoneNumber] = useState("+14168327527");
  const [taskPrompt, setTaskPrompt] = useState(
    "You are a helpful AI assistant. Greet the caller and ask how you can help them."
  );
  const [taskType, setTaskType] = useState("custom");
  const [voice, setVoice] = useState("verse");
  const [temperature, setTemperature] = useState(0.8);
  const [noiseReduction, setNoiseReduction] = useState<
    "near_field" | "far_field" | "off"
  >("far_field");
  const [model, setModel] = useState("gpt-realtime");
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentCallSid, setCurrentCallSid] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<WebSocket | null>(null);

  // Fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch("/api/models");
        const data = await response.json();
        if (data.models && data.models.length > 0) {
          setAvailableModels(data.models);
          addLog(`Loaded ${data.models.length} available models`);
        }
      } catch (error) {
        console.error("Failed to fetch models:", error);
        // Fallback to default models
        setAvailableModels([
          {
            id: "gpt-realtime",
            created: 0,
            owned_by: "openai",
            description: "Latest realtime model",
          },
          {
            id: "gpt-4o-realtime-preview-2025-06-03",
            created: 0,
            owned_by: "openai",
            description: "GPT-4o Realtime (2025-06-03)",
          },
        ]);
      }
    };
    fetchModels();
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const initiateCall = async () => {
    try {
      addLog("Initiating call...");
      const response = await fetch(
        "https://rida-mbp-agentify-voice.rida.me/twilio/outbound-call",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: phoneNumber,
            task: {
              type: taskType,
              prompt: taskPrompt,
              context: {},
            },
            agentConfig: {
              voice,
              temperature,
              noiseReduction,
              model,
            },
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setCurrentCallSid(data.callSid);
        setIsCallActive(true);
        addLog(`Call initiated: ${data.callSid}`);

        // Start listening for call events via SSE
        startEventStream(data.callSid);
      } else {
        addLog(`Call failed: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      addLog(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const startEventStream = (callSid: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Connect to WebSocket for real-time events
    const ws = new WebSocket(
      "wss://rida-mbp-agentify-voice.rida.me/twilio/events"
    );

    ws.onopen = () => {
      addLog("Connected to event stream");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Only process events for this call
        if (data.callSid !== callSid) return;

        if (data.type === "transcript.ai") {
          setTranscript((prev) => [
            ...prev,
            {
              timestamp: new Date(data.timestamp).toLocaleTimeString(),
              speaker: "ai",
              text: data.data.text,
            },
          ]);
        } else if (data.type === "transcript.user") {
          setTranscript((prev) => [
            ...prev,
            {
              timestamp: new Date(data.timestamp).toLocaleTimeString(),
              speaker: "user",
              text: data.data.text,
            },
          ]);
        } else if (data.type === "tool.called") {
          setToolCalls((prev) => [
            ...prev,
            {
              timestamp: new Date(data.timestamp).toLocaleTimeString(),
              name: data.data.name,
              arguments: data.data.arguments,
            },
          ]);
          addLog(`🔧 Tool called: ${data.data.name}`);
        } else if (data.type === "call.ending") {
          addLog(`🔚 AI ending call: ${data.data.reason}`);
        } else if (data.type === "call.ended") {
          setIsCallActive(false);
          addLog("✅ Call ended");
        }
      } catch (error) {
        console.error("Error parsing event:", error);
      }
    };

    ws.onerror = (error) => {
      addLog(`WebSocket error: ${error}`);
    };

    ws.onclose = () => {
      addLog("Disconnected from event stream");
    };

    eventSourceRef.current = ws as any;
  };

  const endCall = async () => {
    if (!currentCallSid) return;

    try {
      addLog("Ending call...");

      // Call the backend to end the Twilio call
      const response = await fetch(
        `https://rida-mbp-agentify-voice.rida.me/twilio/end-call/${currentCallSid}`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Failed to end call");
      }

      setIsCallActive(false);
      setCurrentCallSid(null);
      addLog("Call ended successfully");
    } catch (error) {
      addLog(
        `Error ending call: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  const clearTranscript = () => {
    setTranscript([]);
    setToolCalls([]);
    setLogs([]);
  };

  const startListening = async () => {
    if (!currentCallSid) {
      addLog("No active call to listen to");
      return;
    }

    try {
      // Create AudioContext
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create gain node for volume control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.8; // Default volume
      gainNode.connect(audioContext.destination);

      // Connect to audio stream WebSocket
      const ws = new WebSocket(
        `wss://rida-mbp-agentify-voice.rida.me/twilio/audio-stream/${currentCallSid}`
      );
      audioStreamRef.current = ws;

      ws.onopen = () => {
        addLog("🎧 Started listening to call audio");
        setIsListening(true);
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "audio") {
            // Decode base64 audio
            const audioData = atob(data.payload);
            const audioArray = new Uint8Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
              audioArray[i] = audioData.charCodeAt(i);
            }

            // Convert to Float32Array based on codec
            let float32Array;
            let sourceSampleRate;
            if (data.codec === "g711_ulaw") {
              // Decode μ-law to PCM (8kHz for phone audio)
              float32Array = decodeULaw(audioArray);
              sourceSampleRate = 8000;
            } else {
              // PCM16 from OpenAI (24kHz)
              float32Array = decodePCM16(audioArray);
              sourceSampleRate = 24000;
            }

            // Resample to AudioContext sample rate if needed
            const targetSampleRate = audioContext.sampleRate;
            if (sourceSampleRate !== targetSampleRate) {
              float32Array = resampleAudio(
                float32Array,
                sourceSampleRate,
                targetSampleRate
              );
            }

            // Create audio buffer and play
            const audioBuffer = audioContext.createBuffer(
              1,
              float32Array.length,
              targetSampleRate
            );
            audioBuffer.getChannelData(0).set(float32Array);

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(gainNode);
            source.start();
          }
        } catch (error) {
          console.error("Error playing audio:", error);
        }
      };

      ws.onerror = (error) => {
        addLog("Audio stream error");
        console.error(error);
      };

      ws.onclose = () => {
        addLog("🎧 Stopped listening to call audio");
        setIsListening(false);
      };
    } catch (error) {
      addLog(
        `Error starting audio: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.close();
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsListening(false);
    addLog("Stopped listening");
  };

  // μ-law decoder
  const decodeULaw = (ulaw: Uint8Array): Float32Array => {
    const ULAW_BIAS = 33;
    const ULAW_CLIP = 32635;
    const pcm = new Float32Array(ulaw.length);

    for (let i = 0; i < ulaw.length; i++) {
      let sample = ~ulaw[i];
      const sign = (sample & 0x80) >> 7;
      const exponent = (sample >> 4) & 0x07;
      const mantissa = sample & 0x0f;

      sample = mantissa << (exponent + 3);
      sample += exponent === 0 ? 0 : (1 << (exponent + 7)) - ULAW_BIAS;

      if (sign) sample = -sample;

      pcm[i] = Math.max(-ULAW_CLIP, Math.min(ULAW_CLIP, sample)) / 32768.0;
    }

    return pcm;
  };

  // PCM16 decoder
  const decodePCM16 = (pcm16: Uint8Array): Float32Array => {
    const float32 = new Float32Array(pcm16.length / 2);
    const view = new DataView(pcm16.buffer);

    for (let i = 0; i < float32.length; i++) {
      const sample = view.getInt16(i * 2, true); // little-endian
      float32[i] = sample / 32768.0;
    }

    return float32;
  };

  // Simple linear resampling
  const resampleAudio = (
    audioData: Float32Array,
    sourceSampleRate: number,
    targetSampleRate: number
  ): Float32Array => {
    if (sourceSampleRate === targetSampleRate) {
      return audioData;
    }

    const ratio = sourceSampleRate / targetSampleRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexInt = Math.floor(srcIndex);
      const fraction = srcIndex - srcIndexInt;

      if (srcIndexInt + 1 < audioData.length) {
        // Linear interpolation
        result[i] =
          audioData[srcIndexInt] * (1 - fraction) +
          audioData[srcIndexInt + 1] * fraction;
      } else {
        result[i] = audioData[srcIndexInt];
      }
    }

    return result;
  };


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">
            Twilio Voice Agent Monitor
          </h1>
          <p className="text-gray-400">
            Initiate and monitor AI voice calls via Twilio
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Call Setup */}
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Call Configuration</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    placeholder="+1234567890"
                    disabled={isCallActive}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Task Type
                  </label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    disabled={isCallActive}
                  >
                    <option value="custom">Custom</option>
                    <option value="appointment_reminder">
                      Appointment Reminder
                    </option>
                    <option value="survey">Survey</option>
                    <option value="notification">Notification</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Voice
                  </label>
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    disabled={isCallActive}
                  >
                    <option value="alloy">Alloy (Neutral)</option>
                    <option value="ash">Ash</option>
                    <option value="ballad">Ballad</option>
                    <option value="coral">Coral</option>
                    <option value="echo">Echo (Male)</option>
                    <option value="sage">Sage</option>
                    <option value="verse">Verse (Default)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Temperature: {temperature.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                    disabled={isCallActive}
                  />
                  <div className="text-xs text-gray-400 mt-1">
                    Lower = more focused, Higher = more creative
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Noise Reduction
                  </label>
                  <select
                    value={noiseReduction}
                    onChange={(e) =>
                      setNoiseReduction(
                        e.target.value as "near_field" | "far_field" | "off"
                      )
                    }
                    className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    disabled={isCallActive}
                  >
                    <option value="far_field">
                      Far Field (Recommended for phones)
                    </option>
                    <option value="near_field">
                      Near Field (For close microphones)
                    </option>
                    <option value="off">Off</option>
                  </select>
                  <div className="text-xs text-gray-400 mt-1">
                    Filters background noise and improves audio quality
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Model
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    disabled={isCallActive}
                  >
                    {availableModels.length > 0 ? (
                      availableModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id}
                          {m.description && ` - ${m.description}`}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="gpt-realtime">
                          gpt-realtime (Latest)
                        </option>
                        <option value="gpt-4o-realtime-preview-2025-06-03">
                          gpt-4o-realtime-preview-2025-06-03
                        </option>
                      </>
                    )}
                  </select>
                  <div className="text-xs text-gray-400 mt-1">
                    Choose the OpenAI Realtime model for the call
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Task Prompt
                  </label>
                  <textarea
                    value={taskPrompt}
                    onChange={(e) => setTaskPrompt(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-sm"
                    placeholder="Enter the task instructions for the AI agent..."
                    disabled={isCallActive}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={initiateCall}
                    disabled={isCallActive || !phoneNumber}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors"
                  >
                    {isCallActive ? "Call in Progress..." : "Initiate Call"}
                  </button>

                  {isCallActive && (
                    <>
                      <button
                        onClick={endCall}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium transition-colors"
                      >
                        End Call
                      </button>
                      {!isListening ? (
                        <button
                          onClick={startListening}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
                        >
                          🎧 Listen In
                        </button>
                      ) : (
                        <button
                          onClick={stopListening}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded font-medium transition-colors"
                        >
                          🔇 Stop Listening
                        </button>
                      )}
                    </>
                  )}
                </div>

                {currentCallSid && (
                  <div className="text-sm text-gray-400">
                    Call SID:{" "}
                    <code className="text-blue-400">{currentCallSid}</code>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Presets */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Quick Presets</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setTaskType("custom");
                    setTaskPrompt(
                      "You are a caregiver calling a public transit company to schedule a wheelchair accessible ride for client number 4773 on Tuesday at 8:30 from home to school. Stay focused on the task when talking with the booking agent. You always speak in English unless the user explicitly asks you to speak in a different language. Be succinct and not too wordy. don't speak for too long and allow the other end to speak, expect to be put on hold too."
                    );
                  }}
                  className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-left text-sm transition-colors"
                  disabled={isCallActive}
                >
                  🚐 Transit Booking (Caregiver)
                </button>
                <button
                  onClick={() => {
                    setTaskType("appointment_reminder");
                    setTaskPrompt(
                      "Remind the person about their appointment tomorrow at 2 PM with Dr. Smith at the medical clinic. Ask them to confirm they can attend."
                    );
                  }}
                  className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-left text-sm transition-colors"
                  disabled={isCallActive}
                >
                  📅 Appointment Reminder
                </button>
                <button
                  onClick={() => {
                    setTaskType("survey");
                    setTaskPrompt(
                      "Conduct a brief customer satisfaction survey. Ask: 1) How satisfied are you with our service? 2) Would you recommend us to others? 3) Any suggestions for improvement?"
                    );
                  }}
                  className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-left text-sm transition-colors"
                  disabled={isCallActive}
                >
                  📊 Quick Survey
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Live Monitor */}
          <div className="space-y-4">
            {/* Transcript */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Live Transcript</h2>
                <button
                  onClick={clearTranscript}
                  className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                >
                  Clear
                </button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {transcript.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No conversation yet. Start a call to see the transcript.
                  </p>
                ) : (
                  transcript.map((item, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          item.speaker === "ai" ? "bg-blue-500" : "bg-green-500"
                        }`}
                      />
                      <div className="flex-1">
                        <div className="text-xs text-gray-400 mb-1">
                          {item.speaker === "ai" ? "🤖 AI Agent" : "👤 User"} •{" "}
                          {item.timestamp}
                        </div>
                        <div className="text-sm">{item.text}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Tool Calls */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Tool Calls</h3>
                <span className="text-xs text-gray-400">
                  Available: end_call
                </span>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {toolCalls.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No tools called yet
                  </p>
                ) : (
                  toolCalls.map((call, idx) => (
                    <div key={idx} className="bg-gray-700 rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-orange-400">🔧</span>
                        <span className="font-mono text-sm font-semibold">
                          {call.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {call.timestamp}
                        </span>
                      </div>
                      <div className="ml-6 text-xs font-mono text-gray-300">
                        {JSON.stringify(call.arguments, null, 2)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Logs */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Activity Log</h3>
              <div className="space-y-1 max-h-64 overflow-y-auto font-mono text-xs">
                {logs.length === 0 ? (
                  <p className="text-gray-500">No activity yet</p>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} className="text-gray-300">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
