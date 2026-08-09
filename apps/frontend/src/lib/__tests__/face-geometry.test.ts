import { describe, it, expect } from 'vitest';
import {
  calculateEAR,
  calculateBothEyesEAR,
  normalizeLandmarks,
  selectIdentityLandmarks,
  validateLandmarks,
  FACE_LANDMARK_INDICES,
} from '../face-geometry';

// ─── Synthetic 478 landmark generator ──────────────────────────
//
// Returns landmarks that pass validateLandmarks() (spread across
// [0..1] range with sufficient variation).

function makeLandmarks(options?: { spread?: number }): Array<{ x: number; y: number }> {
  const spread = options?.spread ?? 0.5;
  return Array.from({ length: 478 }, (_, i) => ({
    x: 0.3 + Math.sin(i * 0.1) * spread,
    y: 0.4 + Math.cos(i * 0.15) * spread,
  }));
}

describe('FACE_LANDMARK_INDICES', () => {
  it('should have 133 identity landmarks', () => {
    expect(FACE_LANDMARK_INDICES.IDENTITY_LANDMARKS).toHaveLength(133);
  });

  it('should have 16 left eye indices', () => {
    expect(FACE_LANDMARK_INDICES.LEFT_EYE).toHaveLength(16);
  });

  it('should have 16 right eye indices', () => {
    expect(FACE_LANDMARK_INDICES.RIGHT_EYE).toHaveLength(16);
  });

  it('should have a nose tip index of 1', () => {
    expect(FACE_LANDMARK_INDICES.NOSE_TIP).toBe(1);
  });
});

describe('validateLandmarks', () => {
  it('should return true for valid landmarks', () => {
    expect(validateLandmarks(makeLandmarks())).toBe(true);
  });

  it('should return false for fewer than 100 landmarks', () => {
    expect(validateLandmarks([{ x: 0, y: 0 }])).toBe(false);
  });

  it('should return false for all-zero landmarks', () => {
    const allZero = Array.from({ length: 200 }, () => ({ x: 0, y: 0 }));
    expect(validateLandmarks(allZero)).toBe(false);
  });

  it('should return false for landmarks with no spread (all identical)', () => {
    const identical = Array.from({ length: 200 }, () => ({ x: 0.5, y: 0.5 }));
    expect(validateLandmarks(identical)).toBe(false);
  });

  it('should return false when x range is below 0.05', () => {
    // i * 0.0001 gives range = 0.0199 which is < 0.05
    const tight = Array.from({ length: 200 }, (_, i) => ({
      x: 0.5 + i * 0.0001,
      y: 0.5 + i * 0.0001,
    }));
    // Ensure xRange < 0.05
    const xs = tight.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.05);
    expect(validateLandmarks(tight)).toBe(false);
  });
});

describe('selectIdentityLandmarks', () => {
  it('should select 132 landmarks from 478', () => {
    const landmarks = makeLandmarks();
    const selected = selectIdentityLandmarks(landmarks);
    expect(selected).toHaveLength(133);
  });

  it('should preserve landmark field structure', () => {
    const landmarks = makeLandmarks();
    const selected = selectIdentityLandmarks(landmarks);
    expect(selected[0]).toHaveProperty('x');
    expect(selected[0]).toHaveProperty('y');
  });
});

describe('normalizeLandmarks', () => {
  it('should shift landmarks relative to nose tip (index 1)', () => {
    // Create landmarks where nose tip (index 1) is at (0.8, 0.8)
    const landmarks = makeLandmarks().map((pt, i) => (i === 1 ? { x: 0.8, y: 0.8 } : pt));

    const normalized = normalizeLandmarks(landmarks);
    const noseTip = normalized[1];

    // Nose tip should be at (0, 0) after normalization
    expect(noseTip.x).toBeCloseTo(0);
    expect(noseTip.y).toBeCloseTo(0);
  });

  it('should return the original array if reference index is out of bounds', () => {
    const landmarks = makeLandmarks();
    const result = normalizeLandmarks(landmarks, 999 as never);
    expect(result).toEqual(landmarks);
  });
});

describe('calculateEAR', () => {
  it('should return a positive value for open eye', () => {
    // Open eye: top points (y=0.32) are between bottom points (y=0.5)
    // with significant separation → EAR is clearly > 0
    const openEye = [
      { x: 0.0, y: 0.5 }, // p6 (bottom outer)
      { x: 0.2, y: 0.3 }, // p1 (outer corner)
      { x: 0.4, y: 0.32 }, // p2 (top outer)
      { x: 0.6, y: 0.32 }, // p3 (top inner)
      { x: 0.8, y: 0.5 }, // p4 (inner corner)
      { x: 0.4, y: 0.5 }, // p5 (bottom inner)
    ];

    const ear = calculateEAR(openEye);
    expect(ear).toBeGreaterThan(0.15);
    expect(ear).toBeLessThan(0.7);
  });

  it('should return 0 for closed eye (top points coincide with bottom points)', () => {
    // Closed eye: p2 coincides with p6, p3 coincides with p5 →
    // verticalA = |p2-p6| = 0, verticalB = |p3-p5| = 0
    const closedEye = [
      { x: 0.0, y: 0.5 }, // p6 (bottom outer)
      { x: 0.2, y: 0.5 }, // p1 (outer corner)
      { x: 0.0, y: 0.5 }, // p2 (top outer) = p6
      { x: 0.6, y: 0.0 }, // p3 (top inner)
      { x: 0.8, y: 0.5 }, // p4 (inner corner)
      { x: 0.6, y: 0.0 }, // p5 (bottom inner) = p3
    ];

    const ear = calculateEAR(closedEye);
    expect(ear).toBe(0);
  });

  it('should return 0 when all points are at the same position (degenerate)', () => {
    // All points identical → horizontal distance = 0 → EAR returns 0
    const degenerate = [
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ];

    expect(calculateEAR(degenerate)).toBe(0);
  });
});

describe('calculateBothEyesEAR', () => {
  it('should compute left, right, and average EAR from face landmarks', () => {
    const landmarks = makeLandmarks();
    const result = calculateBothEyesEAR(landmarks);

    expect(result).toHaveProperty('leftEAR');
    expect(result).toHaveProperty('rightEAR');
    expect(result).toHaveProperty('avgEAR');

    expect(result.leftEAR).toBeGreaterThan(0);
    expect(result.rightEAR).toBeGreaterThan(0);
    expect(result.avgEAR).toBeCloseTo((result.leftEAR + result.rightEAR) / 2, 5);
  });
});
