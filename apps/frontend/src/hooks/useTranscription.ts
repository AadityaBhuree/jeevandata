'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { socketService } from '@/services/socket';

interface UseTranscriptionOptions {
  /** Called when a final transcription is received */
  onFinalText: (text: string) => void;
  /** Called with interim transcription text while recording */
  onInterimText?: (text: string) => void;
}

interface UseTranscriptionReturn {
  /** Current interim transcription text */
  interimText: string;
  /** Most recent final transcription text */
  finalText: string;
  /** Whether transcription is in progress */
  isProcessing: boolean;
  /** Clear the current transcription state */
  clear: () => void;
}

export function useTranscription({
  onFinalText,
  onInterimText,
}: UseTranscriptionOptions): UseTranscriptionReturn {
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const onFinalTextRef = useRef(onFinalText);
  const onInterimTextRef = useRef(onInterimText);

  // Keep callback refs current without re-subscribing
  onFinalTextRef.current = onFinalText;
  onInterimTextRef.current = onInterimText;

  useEffect(() => {
    const unsub = socketService.onTranscriptChunk((data) => {
      setIsProcessing(true);

      if (data.isFinal) {
        setInterimText('');
        setFinalText(data.text);
        onFinalTextRef.current(data.text);
        setIsProcessing(false);
      } else {
        setInterimText(data.text);
        onInterimTextRef.current?.(data.text);
        // Keep isProcessing true while interim is coming in
      }
    });

    // Also listen for errors that might indicate transcription failure
    const unsubError = socketService.onError((data) => {
      if (data.code === 'TRANSCRIPTION_ERROR') {
        setIsProcessing(false);
      }
    });

    return () => {
      unsub();
      unsubError();
    };
  }, []);

  const clear = useCallback(() => {
    setInterimText('');
    setFinalText('');
    setIsProcessing(false);
  }, []);

  return {
    interimText,
    finalText,
    isProcessing,
    clear,
  };
}
