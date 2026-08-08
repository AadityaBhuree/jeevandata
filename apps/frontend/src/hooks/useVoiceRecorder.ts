'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { socketService } from '@/services/socket';
import { useLanguage } from './useLanguage';

const RECORD_TIMESLICE_MS = 200;
const INTERIM_INTERVAL_MS = 2000;
const MAX_RECORDING_DURATION_MS = 30_000;

interface UseVoiceRecorderOptions {
  sessionId: string;
  /** Max recording duration in ms (default 30s) */
  maxDuration?: number;
}

interface UseVoiceRecorderReturn {
  /** Whether the microphone is currently recording */
  isRecording: boolean;
  /** Whether the browser supports the required audio codec */
  isSupported: boolean;
  /** Whether microphone permission is being requested */
  isRequestingPermission: boolean;
  /** Whether there's a permission error */
  permissionError: string | null;
  /** Current recording duration in seconds */
  recordingDurationSec: number;
  /** Current audio level (0-1) for waveform visualization */
  audioLevel: number;
  /** Start recording */
  startRecording: () => Promise<void>;
  /** Stop recording and send final audio for transcription */
  stopRecording: () => void;
  /** Toggle recording */
  toggleRecording: () => Promise<void>;
}

export function useVoiceRecorder({
  sessionId,
  maxDuration = MAX_RECORDING_DURATION_MS,
}: UseVoiceRecorderOptions): UseVoiceRecorderReturn {
  // Patient-selected UI locale (en/hi/mr/es) — forwarded to whisper.cpp per
  // transcription request so audio is decoded in the spoken language.
  const { locale } = useLanguage();

  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [recordingDurationSec, setRecordingDurationSec] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIndexRef = useRef(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interimIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Check codec support on mount
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ||
        MediaRecorder.isTypeSupported('audio/webm') ||
        MediaRecorder.isTypeSupported('audio/ogg;codecs=opus'));
    setIsSupported(supported);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMediaTracks();
      clearIntervals();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      audioContextRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearIntervals() {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (interimIntervalRef.current) {
      clearInterval(interimIntervalRef.current);
      interimIntervalRef.current = null;
    }
  }

  function stopMediaTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function getBestMimeType(): string {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return 'audio/webm;codecs=opus';
    }
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      return 'audio/webm';
    }
    if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
      return 'audio/ogg;codecs=opus';
    }
    return ''; // Let browser decide
  }

  // Send an audio chunk via WebSocket
  function sendAudioChunk(blob: Blob, isFinal: boolean, chunkIndex: number) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      socketService.sendAudioChunk(sessionId, arrayBuffer, chunkIndex, isFinal, locale);
    };
    reader.readAsArrayBuffer(blob);
  }

  // Send interim audio for partial transcription
  function sendInterimAudio() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
      return;
    }
    // Request current data for interim transcription
    mediaRecorderRef.current.requestData();
  }

  // Track audio level using AnalyserNode
  function startAudioLevelTracking(stream: MediaStream) {
    try {
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const value = (dataArray[i] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setAudioLevel(Math.min(rms * 3, 1));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch {
      // Audio level tracking is non-critical
      setAudioLevel(0);
    }
  }

  const startRecording = useCallback(async () => {
    if (isRecording || !isSupported) return;

    setPermissionError(null);
    setIsRequestingPermission(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;
      const mimeType = getBestMimeType();
      const options: MediaRecorderOptions = {};
      if (mimeType) {
        options.mimeType = mimeType;
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunkIndexRef.current = 0;
      startTimeRef.current = Date.now();

      // Handle audio chunks
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const isFinal = recorder.state === 'inactive';
          sendAudioChunk(event.data, isFinal, chunkIndexRef.current++);
        }
      };

      recorder.onstop = () => {
        clearIntervals();
        stopMediaTracks();
        setIsRecording(false);
        setAudioLevel(0);

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };

      recorder.onerror = () => {
        clearIntervals();
        stopMediaTracks();
        setIsRecording(false);
        setPermissionError('Recording error occurred');
      };

      // Start recording with timeslice for periodic chunks
      recorder.start(RECORD_TIMESLICE_MS);
      setIsRecording(true);
      setIsRequestingPermission(false);

      // Track duration
      durationIntervalRef.current = setInterval(() => {
        setRecordingDurationSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
        // Auto-stop if max duration reached
        if (Date.now() - startTimeRef.current >= maxDuration) {
          stopRecording();
        }
      }, 250);

      // Send interim audio for partial transcription every 2 seconds
      interimIntervalRef.current = setInterval(() => {
        sendInterimAudio();
      }, INTERIM_INTERVAL_MS);

      // Start audio level tracking
      startAudioLevelTracking(stream);
    } catch (err: unknown) {
      setIsRequestingPermission(false);
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setPermissionError('Microphone permission denied');
        } else if (err.name === 'NotFoundError') {
          setPermissionError('No microphone found');
        } else {
          setPermissionError(`Microphone error: ${err.message}`);
        }
      } else {
        setPermissionError('Failed to access microphone');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, isSupported, maxDuration, sessionId]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isSupported,
    isRequestingPermission,
    permissionError,
    recordingDurationSec,
    audioLevel,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
