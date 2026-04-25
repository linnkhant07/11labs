"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ConversationEvent =
  | { type: "conversation_initiation_metadata"; conversation_initiation_metadata_event?: { user_input_audio_format?: string } }
  | { type: "user_transcript"; user_transcription_event?: { user_transcript?: string } }
  | { type: "agent_response"; agent_response_event?: { agent_response?: string } }
  | { type: "agent_response_correction"; agent_response_correction_event?: { corrected_agent_response?: string } }
  | { type: "audio"; audio_event?: { audio_base_64?: string } }
  | { type: "interruption" }
  | { type: "ping"; ping_event?: { event_id?: number } }
  | { type: "client_tool_call"; client_tool_call?: { tool_name?: string; tool_call_id?: string; parameters?: Record<string, unknown> } };

function parseSampleRateFromFormat(format?: string): number {
  if (!format) return 16000;
  const match = format.match(/(\d{4,6})/);
  if (!match) return 16000;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 16000;
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function downsampleBuffer(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (outputSampleRate >= inputSampleRate) return input;
  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < output.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i += 1) {
      accum += input[i];
      count += 1;
    }
    output[offsetResult] = count ? accum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return output;
}

function int16ToBase64(buffer: Int16Array): string {
  const bytes = new Uint8Array(buffer.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface ClientToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
  expects_response?: boolean;
}

interface UseConversationalPttOptions {
  agentId?: string;
  inputGain?: number;
  clientTools?: ClientToolDeclaration[];
  onUserTranscript?: (text: string) => void;
  onAgentTranscript?: (text: string) => void;
  onSocketEvent?: (event: { type: string; detail?: string }) => void;
  onToolCall?: (toolCall: {
    toolName: string;
    toolCallId: string;
    parameters: Record<string, unknown>;
  }) => Promise<{ result: string; isError?: boolean }> | { result: string; isError?: boolean };
}
type NarratorId = "fox" | "owl" | "bear";

function getPreferredBuiltInMicId(devices: MediaDeviceInfo[]): string | null {
  const audioInputs = devices.filter((d) => d.kind === "audioinput");
  if (!audioInputs.length) return null;

  const builtIn = audioInputs.find((d) =>
    /(built[\s-]?in|internal|macbook|laptop|default)/i.test(d.label)
  );
  return (builtIn ?? audioInputs[0]).deviceId || null;
}

export function useConversationalPtt(options: UseConversationalPttOptions = {}) {
  const {
    agentId,
    inputGain = 2,
    clientTools,
    onUserTranscript,
    onAgentTranscript,
    onSocketEvent,
    onToolCall,
  } = options;

  const clientToolsRef = useRef<ClientToolDeclaration[] | undefined>(clientTools);
  useEffect(() => {
    clientToolsRef.current = clientTools;
  }, [clientTools]);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserTranscript, setLastUserTranscript] = useState("");
  const [lastAgentTranscript, setLastAgentTranscript] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackTimeRef = useRef(0);
  const targetSampleRateRef = useRef(16000);
  const isTalkingRef = useRef(false);
  const isConnectedRef = useRef(false);
  const isConnectingRef = useRef(false);
  const agentIdRef = useRef<string | undefined>(agentId);

  useEffect(() => {
    agentIdRef.current = agentId;
  }, [agentId]);

  const stopPlayback = useCallback(() => {
    const ctx = playbackContextRef.current;
    if (!ctx) return;
    playbackTimeRef.current = ctx.currentTime;
  }, []);

  const playPcmChunk = useCallback((pcmBytes: Uint8Array, sampleRate: number) => {
    const ctx = playbackContextRef.current;
    if (!ctx) return;

    const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength);
    const sampleCount = pcmBytes.byteLength / 2;
    const float32 = new Float32Array(sampleCount);

    for (let i = 0; i < sampleCount; i += 1) {
      float32[i] = view.getInt16(i * 2, true) / 0x8000;
    }

    const buffer = ctx.createBuffer(1, sampleCount, sampleRate);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (playbackTimeRef.current < now) playbackTimeRef.current = now;
    source.start(playbackTimeRef.current);
    playbackTimeRef.current += buffer.duration;
  }, []);

  const cleanup = useCallback(async () => {
    setIsConnected(false);
    setIsConnecting(false);
    setIsTalking(false);
    isConnectedRef.current = false;
    isConnectingRef.current = false;
    isTalkingRef.current = false;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (micProcessorRef.current) {
      micProcessorRef.current.disconnect();
      micProcessorRef.current.onaudioprocess = null;
      micProcessorRef.current = null;
    }
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micContextRef.current) {
      await micContextRef.current.close();
      micContextRef.current = null;
    }
  }, []);

  const connect = useCallback(async (nextAgentId?: string, narratorId?: NarratorId) => {
    if (isConnectingRef.current || isConnectedRef.current) return;

    const resolvedAgentId = nextAgentId ?? (narratorId ? undefined : agentIdRef.current);
    if (!resolvedAgentId && !narratorId) {
      setError("Missing agent ID for this session.");
      return;
    }

    if (resolvedAgentId) {
      agentIdRef.current = resolvedAgentId;
    }
    setError(null);
    setIsConnecting(true);
    isConnectingRef.current = true;
    setLastUserTranscript("");
    setLastAgentTranscript("");

    try {
      const response = await fetch("/api/talk/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: resolvedAgentId, narratorId }),
      });
      const payload = (await response.json()) as { signedUrl?: string; error?: string; detail?: string };
      if (!response.ok || !payload.signedUrl) {
        throw new Error(payload.error || payload.detail || "Failed to get signed URL");
      }

      // First request mic permission so device labels become available.
      let stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const preferredMicId = getPreferredBuiltInMicId(devices);
      if (preferredMicId) {
        stream.getTracks().forEach((track) => track.stop());
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: preferredMicId },
            channelCount: 1,
            sampleRate: 48000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }
      micStreamRef.current = stream;

      const micContext = new AudioContext();
      micContextRef.current = micContext;

      const playbackContext = new AudioContext();
      playbackContextRef.current = playbackContext;
      playbackTimeRef.current = playbackContext.currentTime;

      const source = micContext.createMediaStreamSource(stream);
      micSourceRef.current = source;

      const processor = micContext.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;

      const ws = new WebSocket(payload.signedUrl);
      wsRef.current = ws;
      onSocketEvent?.({ type: "ws_created" });

      const wsReady = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error("WebSocket open timeout"));
        }, 8000);

        ws.onopen = () => {
          window.clearTimeout(timeout);
          setIsConnected(true);
          setIsConnecting(false);
          isConnectedRef.current = true;
          isConnectingRef.current = false;
          onSocketEvent?.({ type: "ws_open" });
          const declaredTools = clientToolsRef.current ?? [];
          const initPayload: Record<string, unknown> = {
            type: "conversation_initiation_client_data",
          };
          if (declaredTools.length > 0) {
            initPayload.conversation_config_override = {
              agent: {
                prompt: {
                  tools: declaredTools,
                },
              },
            };
          }
          ws.send(JSON.stringify(initPayload));
          onSocketEvent?.({
            type: "conversation_init_sent",
            detail: declaredTools.length
              ? `tools=${declaredTools.map((t) => t.name).join(",")}`
              : "no_tools_declared",
          });
          resolve();
        };
      });

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data) as ConversationEvent;
        const rawDetail =
          typeof event.data === "string"
            ? event.data.length > 500
              ? `${event.data.slice(0, 500)}...`
              : event.data
            : undefined;
        const detailForLog = data.type === "audio" ? undefined : rawDetail;
        onSocketEvent?.({ type: `ws_message_${data.type}`, detail: detailForLog });

        if (data.type === "ping" && data.ping_event?.event_id != null) {
          ws.send(JSON.stringify({ type: "pong", event_id: data.ping_event.event_id }));
          return;
        }
        if (data.type === "conversation_initiation_metadata") {
          targetSampleRateRef.current = parseSampleRateFromFormat(
            data.conversation_initiation_metadata_event?.user_input_audio_format
          );
          return;
        }
        if (data.type === "user_transcript") {
          const transcript = data.user_transcription_event?.user_transcript || "";
          setLastUserTranscript(transcript);
          onUserTranscript?.(transcript);
          return;
        }
        if (data.type === "agent_response") {
          const response = data.agent_response_event?.agent_response || "";
          setLastAgentTranscript(response);
          onAgentTranscript?.(response);
          return;
        }
        if (data.type === "agent_response_correction") {
          const corrected =
            data.agent_response_correction_event?.corrected_agent_response || "";
          setLastAgentTranscript(corrected);
          onAgentTranscript?.(corrected);
          return;
        }
        if (data.type === "interruption") {
          stopPlayback();
          return;
        }
        if (data.type === "audio" && data.audio_event?.audio_base_64) {
          const bytes = base64ToUint8(data.audio_event.audio_base_64);
          try {
            playPcmChunk(bytes, 16000);
          } catch {
            // Ignore unexpected playback chunks.
          }
          return;
        }
        if (data.type === "client_tool_call" && data.client_tool_call) {
          const toolName = data.client_tool_call.tool_name;
          const toolCallId = data.client_tool_call.tool_call_id;
          const parameters = data.client_tool_call.parameters ?? {};

          if (!toolName || !toolCallId) return;

          try {
            const toolResult = onToolCall
              ? await onToolCall({ toolName, toolCallId, parameters })
              : { result: `Unhandled tool call: ${toolName}`, isError: true };

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "client_tool_result",
                  tool_call_id: toolCallId,
                  result: toolResult.result,
                  is_error: Boolean(toolResult.isError),
                })
              );
            }
          } catch (toolError) {
            const message =
              toolError instanceof Error ? toolError.message : "Tool call handler failed.";
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "client_tool_result",
                  tool_call_id: toolCallId,
                  result: message,
                  is_error: true,
                })
              );
            }
          }
        }
      };

      ws.onerror = () => {
        onSocketEvent?.({ type: "ws_error" });
        setError("WebSocket connection error");
      };
      ws.onclose = () => {
        onSocketEvent?.({ type: "ws_close" });
        void cleanup();
      };

      processor.onaudioprocess = (event) => {
        if (
          !wsRef.current ||
          wsRef.current.readyState !== WebSocket.OPEN ||
          !isTalkingRef.current
        ) {
          return;
        }

        const input = event.inputBuffer.getChannelData(0);
        const boosted = new Float32Array(input.length);
        for (let i = 0; i < input.length; i += 1) {
          const sample = input[i] * inputGain;
          boosted[i] = Math.max(-1, Math.min(1, sample));
        }
        const downsampled = downsampleBuffer(
          boosted,
          micContext.sampleRate,
          targetSampleRateRef.current
        );
        const pcm = floatTo16BitPCM(downsampled);
        const payloadBase64 = int16ToBase64(pcm);
        wsRef.current.send(JSON.stringify({ user_audio_chunk: payloadBase64 }));
      };

      source.connect(processor);
      processor.connect(micContext.destination);
      await wsReady;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      setError(message);
      onSocketEvent?.({ type: "connect_error", detail: message });
      await cleanup();
    }
  }, [
    cleanup,
    inputGain,
    onAgentTranscript,
    onSocketEvent,
    onToolCall,
    onUserTranscript,
    playPcmChunk,
    stopPlayback,
  ]);

  const connectForNarrator = useCallback(
    async (narratorId: NarratorId) => {
      await connect(undefined, narratorId);
    },
    [connect]
  );

  const disconnect = useCallback(async () => {
    await cleanup();
  }, [cleanup]);

  const startTalking = useCallback(() => {
    isTalkingRef.current = true;
    setIsTalking(true);
  }, []);
  const stopTalking = useCallback(() => {
    isTalkingRef.current = false;
    setIsTalking(false);
  }, []);

  const sendUserMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onSocketEvent?.({ type: "user_message_dropped", detail: "socket_not_open" });
      return;
    }
    wsRef.current.send(JSON.stringify({ type: "user_message", text }));
    onSocketEvent?.({ type: "user_message_sent", detail: text.slice(0, 80) });
  }, [onSocketEvent]);

  useEffect(() => {
    return () => {
      isTalkingRef.current = false;
      void cleanup();
    };
  }, [cleanup]);

  return {
    connect,
    connectForNarrator,
    disconnect,
    startTalking,
    stopTalking,
    sendUserMessage,
    isConnecting,
    isConnected,
    isTalking,
    error,
    lastUserTranscript,
    lastAgentTranscript,
  };
}
