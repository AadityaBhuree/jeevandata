'use client';

import { useEffect, useState, useCallback } from 'react';

export interface MobileDetectionResult {
  /** Whether the device is likely a mobile phone or tablet */
  isMobile: boolean;
  /** Whether the device supports touch events */
  isTouchDevice: boolean;
  /** Whether the device is a tablet (larger screen, touch-capable) */
  isTablet: boolean;
  /** Whether the device is iOS */
  isIOS: boolean;
  /** Whether the device is Android */
  isAndroid: boolean;
  /** Whether the device likely has limited GPU (use CPU delegate) */
  hasLimitedGPU: boolean;
  /** Whether the device is in landscape orientation */
  isLandscape: boolean;
  /** The device pixel ratio (1 = standard, 2+ = retina) */
  devicePixelRatio: number;
  /** Screen width in CSS pixels */
  screenWidth: number;
  /** Screen height in CSS pixels */
  screenHeight: number;
}

function detectMobile(): MobileDetectionResult {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTouchDevice: false,
      isTablet: false,
      isIOS: false,
      isAndroid: false,
      hasLimitedGPU: false,
      isLandscape: false,
      devicePixelRatio: 1,
      screenWidth: 1024,
      screenHeight: 768,
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const isLandscape = screenWidth > screenHeight;

  // Check for tablet: iPad, or large Android screen with touch
  const isTablet =
    (isIOS && /ipad/.test(ua)) ||
    (isAndroid && screenWidth >= 600 && !/mobile/.test(ua)) ||
    (isTouchDevice && screenWidth >= 768 && screenWidth <= 1024);

  // Mobile if: small screen, or touch device that's not a tablet
  const isMobile = screenWidth < 768 || (isTouchDevice && !isTablet) || isIOS || isAndroid;

  // Limited GPU: iOS devices, older Android, or low-end devices
  const hasLimitedGPU = isIOS || isAndroid;

  return {
    isMobile,
    isTouchDevice,
    isTablet,
    isIOS,
    isAndroid,
    hasLimitedGPU,
    isLandscape,
    devicePixelRatio,
    screenWidth,
    screenHeight,
  };
}

export function useMobileDetection(): MobileDetectionResult {
  const [result, setResult] = useState<MobileDetectionResult>(detectMobile);

  const handleResize = useCallback(() => {
    setResult(detectMobile());
  }, []);

  useEffect(() => {
    // Re-check on resize (orientation change)
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  return result;
}
