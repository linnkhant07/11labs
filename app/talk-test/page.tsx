"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ConversationEvent =
  | { type: "conversation_initiation_metadata"; conversation_initiation_metadata_event?: { user_input_audio_format?: string; agent_output_audio_format?: string } }
  | { type: "user_transcript"; user_transcription_event?: { user_transcript?: string } }
  | { type: "agent_response"; agent_response_event?: { agent_response?: string } }
  | { type: "agent_response_correction"; agent_response_correction_event?: { corrected_agent_response?: string } }
  | { type: "audio"; audio_event?: { audio_base_64?: string } }
  | { type: "interruption" }
  | { type: "ping"; ping_event?: { event_id?: number; ping_ms?: number } };

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
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
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
    output[offsetResult] = accum / count;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return output;
}

function computeRms(input: Float32Array): number {
  if (!input.length) return 0;
  let sumSquares = 0;
  for (let i = 0; i < input.length; i += 1) {
    sumSquares += input[i] * input[i];
  }
  return Math.sqrt(sumSquares / input.length);
}

function int16ToBase64(buffer: Int16Array): string {
  const bytes = new Uint8Array(buffer.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default function TalkTestPage() {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [userTranscript, setUserTranscript] = useState("");
  const [agentTranscript, setAgentTranscript] = useState("");
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const [chunksSent, setChunksSent] = useState(0);
  const [inputFormat, setInputFormat] = useState("unknown");
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [lastEventType, setLastEventType] = useState("none");
  const [lastChunkBytes, setLastChunkBytes] = useState(0);
  const [micSampleRate, setMicSampleRate] = useState(0);
  const [micRms, setMicRms] = useState(0);
  const [inputGain, setInputGain] = useState(2);
  const [targetSampleRate, setTargetSampleRate] = useState(16000);

  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackTimeRef = useRef(0);
  const targetSampleRateRef = useRef(16000);
  const chunksSentRef = useRef(0);
  const rmsIntervalRef = useRef<number | null>(null);

  const canStart = useMemo(() => !isConnected && !isConnecting, [isConnected, isConnecting]);

  const pushDebug = useCallback((message: string) => {
    const line = `${new Date().toLocaleTimeString()} ${message}`;
    console.log(`[talk-test] ${line}`);
    setDebugLog((prev) => [...prev.slice(-24), line]);
  }, []);

  const loadAudioInputs = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((d) => d.kind === "audioinput");
    setAudioInputs(inputs);
    if (!selectedDeviceId && inputs.length > 0) {
      setSelectedDeviceId(inputs[0].deviceId);
    }
  }, [selectedDeviceId]);

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
      const sample = view.getInt16(i * 2, true);
      float32[i] = sample / 0x8000;
    }

    const audioBuffer = ctx.createBuffer(1, sampleCount, sampleRate);
    audioBuffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (playbackTimeRef.current < now) {
      playbackTimeRef.current = now;
    }
    source.start(playbackTimeRef.current);
    playbackTimeRef.current += audioBuffer.duration;
  }, []);

  const playCompressedChunk = useCallback(async (bytes: Uint8Array) => {
    const ctx = playbackContextRef.current;
    if (!ctx) return;
    const copy = bytes.slice().buffer;
    const decoded = await ctx.decodeAudioData(copy);
    const source = ctx.createBufferSource();
    source.buffer = decoded;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (playbackTimeRef.current < now) {
      playbackTimeRef.current = now;
    }
    source.start(playbackTimeRef.current);
    playbackTimeRef.current += decoded.duration;
  }, []);

  const stopConversation = useCallback(async () => {
    if (rmsIntervalRef.current != null) {
      window.clearInterval(rmsIntervalRef.current);
      rmsIntervalRef.current = null;
    }

    pushDebug("Stopping conversation");
    setStatus("Disconnected");
    setIsConnected(false);
    setIsConnecting(false);

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
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (micAudioContextRef.current) {
      await micAudioContextRef.current.close();
      micAudioContextRef.current = null;
    }
  }, [pushDebug]);

  const startConversation = useCallback(async () => {
    setError(null);
    setStatus("Requesting signed URL...");
    setIsConnecting(true);
    setUserTranscript("");
    setAgentTranscript("");
    setChunksSent(0);
    chunksSentRef.current = 0;
    setInputFormat("unknown");
    setLastEventType("none");
    setLastChunkBytes(0);
    setMicSampleRate(0);
    setMicRms(0);
    targetSampleRateRef.current = 16000;
    setTargetSampleRate(16000);
    setDebugLog([]);
    pushDebug("Starting conversation flow");

    try {
      const sessionResponse = await fetch("/api/talk/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agentId.trim() || undefined }),
      });

      const sessionJson = (await sessionResponse.json()) as {
        signedUrl?: string;
        error?: string;
        detail?: string;
      };

      if (!sessionResponse.ok || !sessionJson.signedUrl) {
        throw new Error(sessionJson.error || sessionJson.detail || "Failed to get signed URL.");
      }
      pushDebug("Signed URL received");

      setStatus("Accessing microphone...");
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = micStream;
      pushDebug(`Mic permission granted. Track count=${micStream.getAudioTracks().length}`);
      await loadAudioInputs();

      const micContext = new AudioContext();
      setMicSampleRate(micContext.sampleRate);
      pushDebug(`Mic AudioContext sampleRate=${micContext.sampleRate}`);
      const playbackContext = new AudioContext();
      micAudioContextRef.current = micContext;
      playbackContextRef.current = playbackContext;
      playbackTimeRef.current = playbackContext.currentTime;

      const source = micContext.createMediaStreamSource(micStream);
      micSourceRef.current = source;

      const processor = micContext.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;

      const websocket = new WebSocket(sessionJson.signedUrl);
      wsRef.current = websocket;
      pushDebug("Opening websocket");

      websocket.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setStatus("Connected");
        pushDebug("Websocket connected");
        websocket.send(JSON.stringify({ type: "conversation_initiation_client_data" }));
        pushDebug("Sent conversation_initiation_client_data");
      };

      websocket.onmessage = async (event) => {
        const data = JSON.parse(event.data) as ConversationEvent;
        setLastEventType(data.type);

        if (data.type === "ping" && data.ping_event?.event_id != null) {
          websocket.send(JSON.stringify({ type: "pong", event_id: data.ping_event.event_id }));
          pushDebug(`Received ping; replied pong event_id=${data.ping_event.event_id}`);
          return;
        }

        if (data.type === "conversation_initiation_metadata") {
          const expectedFormat =
            data.conversation_initiation_metadata_event?.user_input_audio_format;
          setInputFormat(expectedFormat || "unknown");
          targetSampleRateRef.current = parseSampleRateFromFormat(expectedFormat);
          setTargetSampleRate(targetSampleRateRef.current);
          pushDebug(
            `Metadata: input_format=${expectedFormat || "unknown"} target_rate=${targetSampleRateRef.current}`
          );
          return;
        }

        if (data.type === "user_transcript") {
          setUserTranscript(data.user_transcription_event?.user_transcript || "");
          return;
        }

        if (data.type === "agent_response") {
          setAgentTranscript(data.agent_response_event?.agent_response || "");
          return;
        }

        if (data.type === "agent_response_correction") {
          setAgentTranscript(
            data.agent_response_correction_event?.corrected_agent_response || ""
          );
          return;
        }

        if (data.type === "interruption") {
          stopPlayback();
          pushDebug("Received interruption event; cleared playback queue");
          return;
        }

        if (data.type === "audio" && data.audio_event?.audio_base_64) {
          const bytes = base64ToUint8(data.audio_event.audio_base_64);
          pushDebug(`Received audio chunk bytes=${bytes.byteLength}`);
          try {
            // Most agents use PCM chunks; fallback to decodeAudioData for compressed chunks.
            playPcmChunk(bytes, 16000);
          } catch {
            await playCompressedChunk(bytes);
          }
        }
      };

      websocket.onerror = () => {
        pushDebug("Websocket error event");
        setError("WebSocket connection error.");
      };

      websocket.onclose = () => {
        pushDebug("Websocket closed");
        void stopConversation();
      };

      processor.onaudioprocess = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || isMuted) return;
        const input = event.inputBuffer.getChannelData(0);
        const boosted = new Float32Array(input.length);
        for (let i = 0; i < input.length; i += 1) {
          const sample = input[i] * inputGain;
          boosted[i] = Math.max(-1, Math.min(1, sample));
        }
        const rms = computeRms(boosted);
        // Avoid re-rendering on every audio callback.
        (window as Window & { __talkTestRms?: number }).__talkTestRms = rms;
        const downsampled = downsampleBuffer(
          boosted,
          micContext.sampleRate,
          targetSampleRateRef.current
        );
        const pcm = floatTo16BitPCM(downsampled);
        const payload = int16ToBase64(pcm);
        wsRef.current.send(JSON.stringify({ user_audio_chunk: payload }));
        setChunksSent((prev) => prev + 1);
        chunksSentRef.current += 1;
        setLastChunkBytes(pcm.byteLength);
        if (chunksSentRef.current % 25 === 0) {
          pushDebug(
            `Sent ${chunksSentRef.current} chunks; latest pcm_bytes=${pcm.byteLength}; rms=${rms.toFixed(
              4
            )}; in_rate=${micContext.sampleRate}; out_rate=${targetSampleRateRef.current}`
          );
        }
      };

      source.connect(processor);
      processor.connect(micContext.destination);
      pushDebug("Audio processor connected");
      rmsIntervalRef.current = window.setInterval(() => {
        const value = (window as Window & { __talkTestRms?: number }).__talkTestRms ?? 0;
        setMicRms(value);
      }, 120);
    } catch (startError) {
      const message =
        startError instanceof Error ? startError.message : "Failed to start conversation.";
      setError(message);
      setStatus("Failed");
      pushDebug(`Start error: ${message}`);
      setIsConnecting(false);
      setIsConnected(false);
      await stopConversation();
    }
  }, [
    agentId,
    inputGain,
    isMuted,
    loadAudioInputs,
    playCompressedChunk,
    playPcmChunk,
    pushDebug,
    selectedDeviceId,
    stopConversation,
    stopPlayback,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAudioInputs();
    }, 0);

    const onDeviceChange = () => {
      void loadAudioInputs();
    };
    navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);

    return () => {
      window.clearTimeout(timer);
      navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
      void stopConversation();
    };
  }, [loadAudioInputs, stopConversation]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">ElevenLabs Talk Test</h1>
      <p className="text-sm text-gray-600">
        Live mic capture + WebSocket streaming + speaker playback.
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Agent ID (optional if in env)</span>
        <input
          className="rounded border px-3 py-2"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="agent_xxx"
          disabled={isConnected || isConnecting}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Microphone input device</span>
        <select
          className="rounded border px-3 py-2"
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          disabled={isConnected || isConnecting}
        >
          {audioInputs.length === 0 ? (
            <option value="">No microphones found</option>
          ) : null}
          {audioInputs.map((device, index) => (
            <option key={device.deviceId || `${device.label}-${index}`} value={device.deviceId}>
              {device.label || `Microphone ${index + 1}`}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-3">
        <button
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          onClick={() => void startConversation()}
          disabled={!canStart}
          type="button"
        >
          {isConnecting ? "Connecting..." : "Start Conversation"}
        </button>
        <button
          className="rounded border px-4 py-2 disabled:opacity-50"
          onClick={() => void stopConversation()}
          disabled={!isConnected && !isConnecting}
          type="button"
        >
          Stop
        </button>
        <button
          className="rounded border px-4 py-2 disabled:opacity-50"
          onClick={() => setIsMuted((prev) => !prev)}
          disabled={!isConnected}
          type="button"
        >
          {isMuted ? "Unmute Mic" : "Mute Mic"}
        </button>
      </div>

      <label className="flex max-w-xs flex-col gap-1 text-sm">
        <span className="font-medium">Input gain: {inputGain.toFixed(1)}x</span>
        <input
          type="range"
          min={1}
          max={6}
          step={0.5}
          value={inputGain}
          onChange={(e) => setInputGain(Number(e.target.value))}
          disabled={!isConnected}
        />
      </label>

      <div className="rounded border p-3 text-sm">
        <p>
          <strong>Status:</strong> {status}
        </p>
        <p>
          <strong>Input format:</strong> {inputFormat}
        </p>
        <p>
          <strong>Audio chunks sent:</strong> {chunksSent}
        </p>
        <p>
          <strong>Mic sample rate:</strong> {micSampleRate || "unknown"}
        </p>
        <p>
          <strong>Target sample rate:</strong> {targetSampleRate}
        </p>
        <p>
          <strong>Last event type:</strong> {lastEventType}
        </p>
        <p>
          <strong>Last chunk bytes:</strong> {lastChunkBytes}
        </p>
        <p>
          <strong>Mic RMS:</strong> {micRms.toFixed(4)}
        </p>
        {error ? (
          <p className="mt-2 text-red-600">
            <strong>Error:</strong> {error}
          </p>
        ) : null}
      </div>

      <div className="rounded border p-3">
        <p className="text-sm font-medium">You said</p>
        <p className="mt-1 min-h-10 text-sm">{userTranscript || "..."}</p>
      </div>

      <div className="rounded border p-3">
        <p className="text-sm font-medium">Agent said</p>
        <p className="mt-1 min-h-10 text-sm">{agentTranscript || "..."}</p>
      </div>

      <div className="rounded border p-3">
        <p className="text-sm font-medium">Debug log</p>
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs">
          {debugLog.length ? debugLog.join("\n") : "No debug events yet."}
        </pre>
      </div>
    </main>
  );
}
