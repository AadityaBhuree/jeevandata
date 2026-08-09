'use client';

import { useCallback, useRef, useState } from 'react';
import { calculateBothEyesEAR } from '@/lib/face-geometry';

export type LivenessStatus =
  | 'idle'
  | 'waiting_for_blink'
  | 'blink_detected'
  | 'verified'
  | 'failed';

interface UseLivenessDetectionOptions {
  /** Threshold for blink detection (EAR below this = blink). Default: 0.20 */
  blinkThreshold?: number;
  /** Number of blinks required for liveness. Default: 2 */
  requiredBlinks?: number;
  /** Timeout in ms for the challenge. Default: 8000 */
  challengeTimeoutMs?: number;
  /** Whether to auto-start on face detection. Default: false */
  autoStart?: boolean;
}

interface UseLivenessDetectionReturn {
  status: LivenessStatus;
  blinkCount: number;
  ear: number;
  isAlive: boolean;
  /** Start the liveness challenge */
  startChallenge: () => void;
  /** Process a new frame's landmarks for blink detection */
  processFrame: (landmarks: Array<{ x: number; y: number; z?: number }>) => void;
  /** Reset liveness state */
  reset: () => void;
}

export function useLivenessDetection(
  options: UseLivenessDetectionOptions = {},
): UseLivenessDetectionReturn {
  const { blinkThreshold = 0.2, requiredBlinks = 2, challengeTimeoutMs = 8000 } = options;

  const [status, setStatus] = useState<LivenessStatus>('idle');
  const [blinkCount, setBlinkCount] = useState(0);
  const [ear, setEar] = useState(0);
  const [isAlive, setIsAlive] = useState(false);

  const blinkStateRef = useRef({
    isEyeClosed: false,
    consecutiveFramesClosed: 0,
    totalBlinks: 0,
    challengeStartTime: 0,
    challengeActive: false,
  });

  const startChallenge = useCallback(() => {
    blinkStateRef.current = {
      isEyeClosed: false,
      consecutiveFramesClosed: 0,
      totalBlinks: 0,
      challengeStartTime: Date.now(),
      challengeActive: true,
    };
    setStatus('waiting_for_blink');
    setBlinkCount(0);
    setIsAlive(false);
  }, []);

  const processFrame = useCallback(
    (landmarks: Array<{ x: number; y: number; z?: number }>) => {
      const state = blinkStateRef.current;
      if (!state.challengeActive) return;

      // Check timeout
      if (Date.now() - state.challengeStartTime > challengeTimeoutMs) {
        state.challengeActive = false;
        setStatus('failed');
        return;
      }

      // Calculate Eye Aspect Ratio
      const eyeData = calculateBothEyesEAR(landmarks);
      setEar(eyeData.avgEAR);

      // Blink detection logic
      const isClosed = eyeData.avgEAR < blinkThreshold;

      if (isClosed) {
        state.consecutiveFramesClosed++;
        state.isEyeClosed = true;
      } else if (state.isEyeClosed && state.consecutiveFramesClosed >= 2) {
        // Blink completed (was closed, now open, and was closed for >= 2 frames)
        state.totalBlinks++;
        state.isEyeClosed = false;
        state.consecutiveFramesClosed = 0;

        setBlinkCount(state.totalBlinks);

        if (state.totalBlinks >= requiredBlinks) {
          state.challengeActive = false;
          setIsAlive(true);
          setStatus('verified');
        } else {
          setStatus('blink_detected');
          // Auto-revert to waiting after short delay
          setTimeout(() => {
            if (blinkStateRef.current.challengeActive) {
              setStatus('waiting_for_blink');
            }
          }, 500);
        }
      } else if (!isClosed) {
        state.consecutiveFramesClosed = 0;
      }
    },
    [blinkThreshold, challengeTimeoutMs, requiredBlinks],
  );

  const reset = useCallback(() => {
    blinkStateRef.current = {
      isEyeClosed: false,
      consecutiveFramesClosed: 0,
      totalBlinks: 0,
      challengeStartTime: 0,
      challengeActive: false,
    };
    setStatus('idle');
    setBlinkCount(0);
    setEar(0);
    setIsAlive(false);
  }, []);

  return {
    status,
    blinkCount,
    ear,
    isAlive,
    startChallenge,
    processFrame,
    reset,
  };
}
