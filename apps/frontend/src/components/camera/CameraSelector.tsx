'use client';

import { useState } from 'react';
import { Camera, RotateCw, Smartphone } from 'lucide-react';
import type { CameraDevice } from '@/hooks/useCamera';
import { cn } from '@/lib/utils';

interface CameraSelectorProps {
  /** Current facing mode */
  currentFacingMode: 'user' | 'environment';
  /** Available camera devices */
  devices: CameraDevice[];
  /** Whether the stream is active */
  isActive: boolean;
  /** Error message if camera failed */
  error: string | null;
  /** Toggle between front and rear camera */
  onToggleCamera: () => Promise<void>;
  /** Start the camera */
  onStartCamera: () => Promise<void>;
  /** Stop the camera */
  onStopCamera: () => void;
  /** Whether the device is mobile */
  isMobile: boolean;
  /** Whether enumeration is still in progress (optional) */
  isEnumeratingDevices?: boolean;
  className?: string;
}

export function CameraSelector({
  currentFacingMode,
  devices,
  isActive,
  error: cameraError,
  onToggleCamera,
  onStartCamera,
  onStopCamera,
  isMobile,
  isEnumeratingDevices = false,
  className,
}: CameraSelectorProps) {
  const [isSwitching, setIsSwitching] = useState(false);

  const handleToggle = async () => {
    setIsSwitching(true);
    try {
      await onToggleCamera();
    } finally {
      setTimeout(() => setIsSwitching(false), 500);
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Main camera controls */}
      <div className="flex gap-2">
        {!isActive ? (
          <button
            onClick={onStartCamera}
            disabled={isEnumeratingDevices}
            className="bg-jeevandata-500 hover:bg-jeevandata-600 focus:ring-jeevandata-500 flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            {isEnumeratingDevices ? 'Detecting cameras...' : 'Start Camera'}
          </button>
        ) : (
          <>
            <button
              onClick={onStopCamera}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
            >
              <Camera className="h-4 w-4" />
              Stop Camera
            </button>

            {/* Toggle camera button (only if multiple cameras or mobile) */}
            {(devices.length > 1 || isMobile) && (
              <button
                onClick={handleToggle}
                disabled={isSwitching}
                aria-label={
                  currentFacingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'
                }
                title={
                  currentFacingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'
                }
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <RotateCw
                  className={cn('h-4 w-4 transition-transform', isSwitching && 'animate-spin')}
                />
                <span className="hidden text-xs sm:inline">
                  {currentFacingMode === 'user' ? 'Rear' : 'Front'}
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Device info (mobile pill) */}
      {isActive && (
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
          <Smartphone className="h-3 w-3" />
          <span>
            {currentFacingMode === 'user' ? 'Front' : 'Rear'} camera
            {devices.length > 0 && (
              <span className="opacity-60">
                {' · '}
                {isEnumeratingDevices
                  ? '...'
                  : `${devices.length} camera${devices.length !== 1 ? 's' : ''} available`}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Error message + recovery guidance */}
      {cameraError && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-3 ring-1 ring-red-200 dark:bg-red-950/30 dark:ring-red-800"
        >
          <p className="text-xs font-medium text-red-700 dark:text-red-400">{cameraError}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-red-600/80 dark:text-red-300/80">
            Camera blocked or unavailable. Click the camera icon in your browser&apos;s address bar,
            choose <span className="font-semibold">Allow</span>, then retry. If you&apos;re on a
            kiosk, check the device&apos;s camera is connected and not in use by another app.
          </p>
          <button
            type="button"
            onClick={() => void onStartCamera()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
          >
            <RotateCw className="h-3 w-3" aria-hidden="true" />
            Retry camera
          </button>
        </div>
      )}
    </div>
  );
}
