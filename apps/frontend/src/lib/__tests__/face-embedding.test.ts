import { describe, it, expect } from 'vitest';
import {
  generateEmbedding,
  extractLandmarks,
  cosineSimilarity,
  patientIdToColor,
} from '../face-embedding';

// ─── Synthetic 478 landmark generator ──────────────────────────
//
// Produces valid 3D landmarks that pass validateLandmarks().
// Each landmark has x, y, z in [0..1] range with sufficient spread.

function makeLandmarks3D(options?: {
  spread?: number;
}): Array<{ x: number; y: number; z: number }> {
  const spread = options?.spread ?? 0.3;
  return Array.from({ length: 478 }, (_, i) => ({
    x: 0.3 + Math.sin(i * 0.1) * spread,
    y: 0.4 + Math.cos(i * 0.15) * spread,
    z: 0.5 + Math.sin(i * 0.2) * spread * 0.5,
  }));
}

describe('generateEmbedding', () => {
  it('should generate a 512-dimensional embedding from valid landmarks', () => {
    const landmarks = makeLandmarks3D();
    const embedding = generateEmbedding(landmarks);

    expect(embedding).toHaveLength(512);
    // Ensure it's an array of numbers
    expect(embedding.every((v) => typeof v === 'number')).toBe(true);
  });

  it('should produce a unit vector (L2 norm ≈ 1)', () => {
    const landmarks = makeLandmarks3D();
    const embedding = generateEmbedding(landmarks);

    const magnitude = Math.sqrt(embedding.reduce((a, b) => a + b * b, 0));
    expect(magnitude).toBeCloseTo(1, 1); // Within 0.1 tolerance
  });

  it('should throw for landmarks with fewer than 100 points', () => {
    expect(() => generateEmbedding([{ x: 0, y: 0, z: 0 }])).toThrow('Invalid landmarks');
  });

  it('should throw for degenerate (all-zero) landmarks', () => {
    const allZero = Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0 }));
    expect(() => generateEmbedding(allZero)).toThrow('Invalid landmarks');
  });

  it('should produce deterministic results for the same input', () => {
    const landmarks = makeLandmarks3D();
    const embedding1 = generateEmbedding(landmarks);
    const embedding2 = generateEmbedding(landmarks);

    expect(embedding1).toEqual(embedding2);
  });

  it('should produce different embeddings for different faces', () => {
    const face1 = makeLandmarks3D({ spread: 0.3 });
    const face2 = makeLandmarks3D({ spread: 0.4 });

    const emb1 = generateEmbedding(face1);
    const emb2 = generateEmbedding(face2);

    // They should not be identical
    expect(emb1).not.toEqual(emb2);
  });
});

describe('extractLandmarks', () => {
  it('should convert MediaPipe landmarks to Landmark3D array', () => {
    const input = [
      { x: 0.1, y: 0.2, z: 0.3 },
      { x: 0.4, y: 0.5 },
    ];

    const result = extractLandmarks(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ x: 0.1, y: 0.2, z: 0.3 });
    expect(result[1]).toEqual({ x: 0.4, y: 0.5, z: 0 }); // z defaults to 0
  });

  it('should preserve precision of coordinates', () => {
    const input = [{ x: 0.123456, y: 0.789012, z: 0.345678 }];
    const result = extractLandmarks(input);

    expect(result[0]!.x).toBe(0.123456);
    expect(result[0]!.y).toBe(0.789012);
    expect(result[0]!.z).toBe(0.345678);
  });
});

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it('should return 0 for perpendicular vectors', () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it('should return a value between -1 and 1 for arbitrary vectors', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThanOrEqual(-1);
    expect(sim).toBeLessThanOrEqual(1);
  });

  it('should return 0 for mismatched lengths', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('should return 0 when magnitude is 0', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });

  it('should return positive similarity for similar vectors', () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1, 2, 3, 4, 5.1]; // slightly different
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0.99);
  });

  it('should be symmetric', () => {
    const a = [1, 0, 1];
    const b = [0, 1, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a));
  });
});

describe('patientIdToColor', () => {
  it('should return an HSL color string', () => {
    const color = patientIdToColor('patient-123');
    expect(color).toMatch(/^hsl\(\d+,\s*70%,\s*50%\)$/);
  });

  it('should return consistent colors for the same ID', () => {
    const color1 = patientIdToColor('patient-abc');
    const color2 = patientIdToColor('patient-abc');
    expect(color1).toBe(color2);
  });

  it('should return different colors for different IDs', () => {
    const color1 = patientIdToColor('patient-aaa');
    const color2 = patientIdToColor('patient-bbb');
    expect(color1).not.toBe(color2);
  });

  it('should handle empty string', () => {
    const color = patientIdToColor('');
    expect(color).toMatch(/^hsl\(\d+,\s*70%,\s*50%\)$/);
  });

  it('should produce hue in range 0-359', () => {
    const color = patientIdToColor('patient-xyz');
    const hue = parseInt(color.match(/hsl\((\d+)/)![1]!, 10);
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });
});
