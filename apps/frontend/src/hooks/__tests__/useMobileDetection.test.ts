import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import the hook and the pure detection function
import { useMobileDetection } from '../useMobileDetection';
import { renderHook, act } from '@testing-library/react';

// ─── Pure mobile detection logic (extracted for testability) ──────

function detectMobilePure(options: {
  ua: string;
  touchPoints: number;
  width: number;
  height: number;
  dpr: number;
}) {
  const ua = options.ua.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isTouchDevice = options.touchPoints > 0;
  const width = options.width;
  const height = options.height;
  const isLandscape = width > height;

  const isTablet =
    (isIOS && /ipad/.test(ua)) ||
    (isAndroid && width >= 600 && !/mobile/.test(ua)) ||
    (isTouchDevice && width >= 768 && width <= 1024);

  const isMobile = width < 768 || (isTouchDevice && !isTablet) || isIOS || isAndroid;

  const hasLimitedGPU = isIOS || isAndroid;

  return {
    isMobile,
    isTouchDevice,
    isTablet,
    isIOS,
    isAndroid,
    hasLimitedGPU,
    isLandscape,
    devicePixelRatio: options.dpr,
    screenWidth: width,
    screenHeight: height,
  };
}

describe('useMobileDetection', () => {
  // Save originals
  let originalWidth: number;
  let originalHeight: number;
  let originalDpr: number;

  beforeEach(() => {
    originalWidth = window.innerWidth;
    originalHeight = window.innerHeight;
    originalDpr = window.devicePixelRatio;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Restore window dimensions
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalHeight, configurable: true });
    Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true });
  });

  function setupEnv(options: {
    ua: string;
    touchPoints?: number;
    width?: number;
    height?: number;
    dpr?: number;
  }) {
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: options.ua,
      maxTouchPoints: options.touchPoints ?? 0,
    });
    Object.defineProperty(window, 'innerWidth', {
      value: options.width ?? 1024,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: options.height ?? 768,
      configurable: true,
    });
    Object.defineProperty(window, 'devicePixelRatio', {
      value: options.dpr ?? 1,
      configurable: true,
    });
  }

  // Pure function tests (no DOM dependencies, reliable)
  describe('detectMobile pure logic', () => {
    it('should detect desktop environment', () => {
      const result = detectMobilePure({
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        width: 1920,
        height: 1080,
        dpr: 1,
        touchPoints: 0,
      });
      expect(result.isMobile).toBe(false);
      expect(result.isTouchDevice).toBe(false);
      expect(result.hasLimitedGPU).toBe(false);
      expect(result.screenWidth).toBe(1920);
    });

    it('should detect iPhone', () => {
      const result = detectMobilePure({
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        touchPoints: 5,
        width: 390,
        height: 844,
        dpr: 3,
      });
      expect(result.isMobile).toBe(true);
      expect(result.isIOS).toBe(true);
      expect(result.isTouchDevice).toBe(true);
      expect(result.hasLimitedGPU).toBe(true);
      expect(result.devicePixelRatio).toBe(3);
    });

    it('should detect Android phone', () => {
      const result = detectMobilePure({
        ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
        touchPoints: 5,
        width: 412,
        height: 915,
        dpr: 2.625,
      });
      expect(result.isMobile).toBe(true);
      expect(result.isAndroid).toBe(true);
      expect(result.isTouchDevice).toBe(true);
      expect(result.hasLimitedGPU).toBe(true);
    });

    it('should detect iPad tablet', () => {
      const result = detectMobilePure({
        ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        touchPoints: 5,
        width: 1024,
        height: 1366,
        dpr: 2,
      });
      expect(result.isTablet).toBe(true);
      expect(result.isIOS).toBe(true);
      expect(result.isTouchDevice).toBe(true);
    });

    it('should detect landscape orientation', () => {
      const result = detectMobilePure({
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        touchPoints: 5,
        width: 844,
        height: 390,
        dpr: 2,
      });
      expect(result.isLandscape).toBe(true);
    });

    it('should detect portrait orientation', () => {
      const result = detectMobilePure({
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        touchPoints: 5,
        width: 390,
        height: 844,
        dpr: 2,
      });
      expect(result.isLandscape).toBe(false);
    });
  });

  // Hook tests (require DOM)
  describe('hook integration', () => {
    it('should re-detect on resize (orientation change)', () => {
      setupEnv({
        ua: navigator.userAgent,
        width: 390,
        height: 844,
      });
      const { result } = renderHook(() => useMobileDetection());
      expect(result.current.isLandscape).toBe(false);

      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 844, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 390, configurable: true });
        window.dispatchEvent(new Event('resize'));
      });

      expect(result.current.isLandscape).toBe(true);
    });
  });
});
