'use client';

import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useTranscription } from '@/hooks/useTranscription';

interface VoiceInputProps {
  /** Current input value */
  value: string;
  /** Called when the input value changes */
  onChange: (value: string) => void;
  /** Called when the user sends a message */
  onSend: (text: string) => void;
  /** Whether the AI is currently processing a response */
  disabled: boolean;
  /** Whether the intake conversation is complete */
  isComplete: boolean;
  /** The current session ID for WebSocket audio streaming */
  sessionId: string;
  /** Placeholder text */
  placeholder?: string;
  /** Patient name for the input label */
  patientName?: string;
}

export function VoiceInput({
  value,
  onChange,
  onSend,
  disabled,
  isComplete,
  sessionId,
  placeholder = 'Type your response or tap the mic...',
  patientName: _patientName = 'Patient',
}: VoiceInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [interimOverride, setInterimOverride] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  // ─── Voice Recorder ─────────────────────────────────────────────
  const {
    isRecording,
    isSupported: micSupported,
    isRequestingPermission,
    permissionError,
    recordingDurationSec,
    audioLevel,
    toggleRecording,
  } = useVoiceRecorder({
    sessionId,
  });

  // ─── Transcription Listener ──────────────────────────────────────
  useTranscription({
    onFinalText: (text) => {
      const trimmed = text.trim();
      if (trimmed) {
        // Review-before-send: fill the input so the patient can correct a
        // mis-transcription before it reaches the AI.
        onChange(trimmed);
        setAwaitingConfirmation(true);
      } else {
        // Nothing was heard — leave a gentle hint instead of silent failure.
        setAwaitingConfirmation(false);
      }
      setInterimOverride('');
    },
    onInterimText: (text) => {
      setInterimOverride(text);
    },
  });

  // Focus input when AI finishes thinking
  useEffect(() => {
    if (!disabled && !isComplete && !isRecording) {
      inputRef.current?.focus();
    }
  }, [disabled, isComplete, isRecording]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim() && !disabled && !isComplete) {
      onSend(value.trim());
      setInterimOverride('');
      setAwaitingConfirmation(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  // Display text: interim transcription takes priority over manual input when recording
  const displayValue = isRecording && interimOverride ? interimOverride : value;
  const displayPlaceholder = isRecording ? 'Listening...' : placeholder;

  // Screen-reader status announcements (role="status" = polite live region)
  const statusMessage = isRecording
    ? 'Recording started. Speak your symptoms now.'
    : disabled
      ? 'AI is thinking'
      : '';

  return (
    <div className="border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      {/* Screen-reader live region for recording / thinking state */}
      <p role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </p>
      {isComplete ? (
        <div className="flex items-center justify-center rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800">
          <svg
            className="mr-2 h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Intake conversation complete. Ready to generate the clinical brief.
        </div>
      ) : (
        <>
          {awaitingConfirmation && !isRecording && (
            <p
              role="status"
              aria-live="polite"
              className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800"
            >
              We heard: <span className="font-semibold">“{value}”</span> — tap{' '}
              <span className="font-semibold">Send</span> if that&apos;s right, or correct the text
              above.
            </p>
          )}
          <form ref={formRef} onSubmit={handleSubmit} className="flex items-center gap-2">
            {/* Microphone Button */}
            <button
              type="button"
              onClick={micSupported ? toggleRecording : undefined}
              disabled={disabled || isRequestingPermission || !micSupported || isComplete}
              className={cn(
                'relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-all',
                isRecording
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                (disabled || !micSupported) && 'cursor-not-allowed opacity-50',
              )}
              aria-label={
                !micSupported
                  ? 'Voice input not supported in this browser'
                  : isRecording
                    ? 'Stop recording'
                    : 'Start voice input'
              }
              aria-pressed={isRecording}
              title={
                !micSupported
                  ? 'Voice input not supported in this browser'
                  : isRecording
                    ? 'Tap to stop recording'
                    : 'Tap to start voice input'
              }
            >
              {/* Mic Icon */}
              {isRecording ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
                  <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                  />
                </svg>
              )}

              {/* Recording indicator dot */}
              {isRecording && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500"
                >
                  <span className="absolute inset-0 animate-ping rounded-full bg-red-400" />
                </span>
              )}
            </button>

            {/* Audio level waveform (shown during recording) */}
            {isRecording && (
              <div className="absolute left-12 right-24 z-10 flex h-full items-center">
                <div className="flex items-center gap-[2px]">
                  {Array.from({ length: 20 }).map((_, i) => {
                    const barHeight = Math.max(
                      4,
                      Math.min(28, audioLevel * 28 * (0.5 + ((i * 7) % 20) / 20)),
                    );
                    return (
                      <div
                        key={i}
                        className="w-[3px] rounded-full bg-red-400 transition-all duration-75"
                        style={{
                          height: `${barHeight}px`,
                          opacity: 0.4 + audioLevel * 0.6,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Text Input */}
            <div className="relative flex-1">
              {disabled && !isRecording && (
                <div className="absolute inset-0 z-10 flex items-center px-3 text-sm text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-2">
                    <span className="flex gap-0.5">
                      <span
                        className="bg-jeevandata-400 h-1.5 w-1.5 animate-bounce rounded-full"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="bg-jeevandata-400 h-1.5 w-1.5 animate-bounce rounded-full"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="bg-jeevandata-400 h-1.5 w-1.5 animate-bounce rounded-full"
                        style={{ animationDelay: '300ms' }}
                      />
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      AI is thinking...
                    </span>
                  </span>
                </div>
              )}

              {isRecording && interimOverride && (
                <div className="absolute inset-0 z-10 flex items-center px-3 text-sm italic text-slate-600 dark:text-slate-300">
                  <span className="truncate">{interimOverride}</span>
                  <span className="bg-jeevandata-500 ml-0.5 h-4 w-[2px] animate-pulse" />
                </div>
              )}

              <input
                ref={inputRef}
                type="text"
                value={displayValue}
                onChange={(e) => {
                  if (!isRecording) {
                    onChange(e.target.value);
                    setAwaitingConfirmation(false);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder={displayPlaceholder}
                aria-label="Type your response"
                disabled={disabled || isRecording}
                className={cn(
                  'w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm transition-colors dark:border-slate-700 dark:bg-slate-800',
                  'placeholder:text-slate-400 dark:placeholder:text-slate-500',
                  'focus:border-jeevandata-400 focus:ring-jeevandata-100 dark:focus:ring-jeevandata-900/50 focus:outline-none focus:ring-2',
                  'disabled:cursor-not-allowed disabled:opacity-100',
                  isRecording ? 'text-transparent' : 'text-slate-900 dark:text-slate-100',
                  disabled && 'text-transparent',
                )}
                autoComplete="off"
              />
            </div>

            {/* Recording Duration Badge */}
            {isRecording && (
              <div className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-800">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                {recordingDurationSec}s
              </div>
            )}

            {/* Send Button */}
            {!isRecording && (
              <button
                type="submit"
                aria-label="Send message"
                disabled={!value.trim() || disabled}
                className={cn(
                  'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-all',
                  value.trim() && !disabled
                    ? 'bg-jeevandata-500 hover:bg-jeevandata-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
                  'disabled:cursor-not-allowed',
                )}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                  />
                </svg>
              </button>
            )}

            {/* Permission Error */}
            {permissionError && (
              <div
                role="alert"
                className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
              >
                <span className="font-semibold">{permissionError}</span>
                <span className="mt-0.5 block text-[11px] opacity-80">
                  Click the microphone icon in your browser&apos;s address bar, choose Allow, then
                  tap the mic again.
                </span>
              </div>
            )}
          </form>
        </>
      )}
    </div>
  );
}
