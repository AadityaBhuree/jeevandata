'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
  facingMode: 'user' | 'environment';
}

interface UseCameraOptions {
  /** Initial facing mode: 'user' (front) or 'environment' (rear) */
  facingMode?: 'user' | 'environment';
  /** Preferred video width */
  width?: number;
  /** Preferred video height */
  height?: number;
  /** Whether this is a mobile device (for auto-selecting rear camera) */
  isMobile?: boolean;
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Whether the camera stream is active */
  isActive: boolean;
  /** Error message if camera access failed */
  error: string | null;
  /** Start the camera */
  startCamera: () => Promise<void>;
  /** Stop the camera */
  stopCamera: () => void;
  /** Capture a still frame from the video */
  captureFrame: () => ImageData | null;
  /** Currently active facing mode */
  currentFacingMode: 'user' | 'environment';
  /** Switch between front and rear camera */
  toggleCamera: () => Promise<void>;
  /** Available camera devices (labels only available after first getUserMedia) */
  devices: CameraDevice[];
  /** Whether the device has multiple cameras */
  hasMultipleCameras: boolean;
  /** Enumerate available cameras (call after user grants permission) */
  enumerateCameras: () => Promise<void>;
}

/** Build video constraints for a given facing mode */
function buildConstraints(
  mode: 'user' | 'environment',
  devices: CameraDevice[],
  width: number,
  height: number,
): MediaTrackConstraints {
  const facingCameras = devices.filter((d) => d.facingMode === mode);
  const constraints: MediaTrackConstraints = {
    width: { ideal: width },
    height: { ideal: height },
  };
  if (facingCameras.length > 0) {
    constraints.deviceId = { exact: facingCameras[0]!.deviceId };
  } else {
    constraints.facingMode = mode;
  }
  return constraints;
}

/** Shared helper: acquire stream for a given facing mode and attach to video element */
async function acquireStream(
  mode: 'user' | 'environment',
  devices: CameraDevice[],
  width: number,
  height: number,
  videoEl: HTMLVideoElement | null,
  previousStream: MediaStream | null,
): Promise<{ stream: MediaStream; error: null } | { stream: null; error: string }> {
  try {
    // Stop previous stream first
    if (previousStream) {
      previousStream.getTracks().forEach((t) => t.stop());
    }

    const constraints = buildConstraints(mode, devices, width, height);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: constraints,
      audio: false,
    });

    if (videoEl) {
      videoEl.srcObject = stream;
      await videoEl.play();
    }

    return { stream, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to access camera';
    return { stream: null, error: message };
  }
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const {
    facingMode: initialFacingMode = 'user',
    width = 640,
    height = 480,
    isMobile = false,
  } = options;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>(
    isMobile ? 'environment' : initialFacingMode,
  );
  const [devices, setDevices] = useState<CameraDevice[]>([]);

  // Enumerate available video devices (call after user grants camera permission)
  const enumerateCameras = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 4)}`,
          facingMode:
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
              ? ('environment' as const)
              : ('user' as const),
        }));

      setDevices(videoDevices);
    } catch {
      // Enumeration failed silently
    }
  }, []);

  // Listen for device changes (e.g., USB camera plugged in)
  useEffect(() => {
    const handleDeviceChange = () => enumerateCameras();
    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [enumerateCameras]);

  const startCamera = useCallback(async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access not supported in this browser');
      return;
    }

    const { stream, error: streamError } = await acquireStream(
      currentFacingMode,
      devices,
      width,
      height,
      videoRef.current,
      null, // no previous stream on first start
    );

    if (streamError) {
      setError(streamError);
      setIsActive(false);
      return;
    }

    streamRef.current = stream;
    setIsActive(true);

    // Enumerate cameras now that we have permission (gets proper labels)
    enumerateCameras();
  }, [currentFacingMode, devices, width, height, enumerateCameras]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
  }, []);

  const toggleCamera = useCallback(async () => {
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    setCurrentFacingMode(newFacingMode);

    // Small delay to allow camera hardware to release
    await new Promise((resolve) => setTimeout(resolve, 300));

    const { stream, error: streamError } = await acquireStream(
      newFacingMode,
      devices,
      width,
      height,
      videoRef.current,
      streamRef.current, // pass current stream to be stopped first
    );

    if (streamError) {
      setError(streamError);
      setIsActive(false);
      return;
    }

    streamRef.current = stream;
    setIsActive(true);
  }, [currentFacingMode, devices, width, height]);

  const captureFrame = useCallback((): ImageData | null => {
    const video = videoRef.current;
    if (!video || !isActive) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, [isActive]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    isActive,
    error,
    startCamera,
    stopCamera,
    captureFrame,
    currentFacingMode,
    toggleCamera,
    devices,
    hasMultipleCameras: devices.length > 1,
    enumerateCameras,
  };
}
