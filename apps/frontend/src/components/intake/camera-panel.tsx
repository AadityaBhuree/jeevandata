'use client';

import type { RefObject } from 'react';
import type { CameraDevice } from '@/hooks/useCamera';
import type { DetectionResult } from '@/hooks/useFaceDetection';
import { cn } from '@/lib/utils';
import { FaceDetectionCanvas } from '@/components/face/FaceDetectionCanvas';
import { CameraSelector } from '@/components/camera/CameraSelector';

interface CameraPanelProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  cameraError: string | null;
  currentFacingMode: 'user' | 'environment';
  devices: CameraDevice[];
  toggleCamera: () => Promise<void>;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  isMobile: boolean;
  detectionResult: DetectionResult | null;
  videoDimensions: { width: number; height: number };
  isFaceDetected: boolean;
  faceStatus: string;
  faceConfidence: number;
  isSearching: boolean;
  mpError: string | null;
  mpLoading: boolean;
  livenessStatus: string;
  blinkCount: number;
  phase: string;
}

export function CameraPanel({
  videoRef,
  isActive,
  cameraError,
  currentFacingMode,
  devices,
  toggleCamera,
  startCamera,
  stopCamera,
  isMobile,
  detectionResult,
  videoDimensions,
  isFaceDetected,
  faceStatus,
  faceConfidence,
  isSearching,
  mpError,
  mpLoading,
  livenessStatus,
  blinkCount,
  phase,
}: CameraPanelProps) {
  return (
    <div className={cn('flex flex-col gap-4', isMobile ? 'w-full' : 'w-[420px]')}>
      <div className="relative overflow-hidden rounded-xl bg-black shadow-lg">
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          autoPlay
          playsInline
          muted
          aria-label="Live camera feed"
          className={cn('h-[320px] w-full object-cover', !isActive && 'hidden')}
        />
        {!isActive && (
          <div className="flex h-[320px] flex-col items-center justify-center bg-slate-900 text-white">
            <svg
              className="mb-3 h-12 w-12 text-slate-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
            <p className="text-sm text-slate-400">Camera not started</p>
          </div>
        )}
        {isActive && detectionResult && (
          <FaceDetectionCanvas
            landmarks={detectionResult.landmarks}
            videoWidth={videoDimensions.width}
            videoHeight={videoDimensions.height}
            isFaceDetected={isFaceDetected}
            matchColor={faceStatus === 'matched' ? '#22c55e' : '#0c8ee6'}
            drawLandmarks
            drawConnections
            drawBoundingBox
          />
        )}
        {phase === 'detecting' && livenessStatus === 'waiting_for_blink' && (
          <div
            role="status"
            aria-live="polite"
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
          >
            <div className="rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm">
              Please blink ({Math.max(0, 2 - blinkCount)} needed)
            </div>
          </div>
        )}
        {livenessStatus === 'blink_detected' && (
          <div
            role="status"
            aria-live="polite"
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
          >
            <div className="rounded-full bg-emerald-500/80 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm">
              Blink detected!
            </div>
          </div>
        )}
        {phase === 'detecting' && mpLoading && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 flex items-center justify-center bg-black/40"
          >
            <div className="text-center">
              <div
                aria-hidden="true"
                className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white"
              />
              <p className="text-sm font-medium text-white">Loading face detection...</p>
            </div>
          </div>
        )}
        {isActive && (
          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {faceStatus === 'matched' && (
              <div className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
                Matched {Math.round(faceConfidence * 100)}%
              </div>
            )}
            {isSearching && (
              <div
                role="status"
                className="bg-jeevandata-500/80 rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm"
              >
                Searching...
              </div>
            )}
            {mpError && (
              <div
                role="alert"
                className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm"
              >
                {mpError}
              </div>
            )}
          </div>
        )}
      </div>
      <CameraSelector
        currentFacingMode={currentFacingMode}
        devices={devices}
        isActive={isActive}
        error={cameraError}
        onToggleCamera={toggleCamera}
        onStartCamera={startCamera}
        onStopCamera={stopCamera}
        isMobile={isMobile}
      />
    </div>
  );
}
