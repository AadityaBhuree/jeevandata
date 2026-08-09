/**
 * Face embedding generation from MediaPipe landmarks.
 *
 * Generates a 512-dimensional embedding vector from 478 MediaPipe face landmarks.
 * The approach selects identity-discriminative landmarks (eyes, nose, mouth, jaw),
 * normalizes them relative to the nose tip, and produces a fixed-size vector.
 *
 * This is a geometric embedding — it works because face geometry is identity-discriminative.
 * In production, this would be replaced by InsightFace ArcFace inference via ONNX Runtime.
 */

import { selectIdentityLandmarks, normalizeLandmarks, validateLandmarks } from './face-geometry';

interface Landmark3D {
  x: number;
  y: number;
  z: number;
}

const TARGET_DIMENSION = 512;

/**
 * Generate a 512-d embedding vector from MediaPipe face landmarks.
 *
 * Strategy:
 * 1. Select identity-discriminative landmarks (132 key points)
 * 2. Normalize relative to nose tip (translation invariance)
 * 3. Create vector from (x, y, z) of selected landmarks = 396 values
 * 4. Add statistical features: min, max, mean, std of x/y/z = 12 values
 * 5. Total: 396 + 12 = 408, pad to 512 with zeros
 * 6. L2-normalize the result
 */
export function generateEmbedding(landmarks: Landmark3D[]): number[] {
  if (!validateLandmarks(landmarks)) {
    throw new Error('Invalid landmarks: insufficient or degenerate');
  }

  // Step 1: Select identity landmarks and normalize
  const selected = selectIdentityLandmarks(landmarks);
  const normalized = normalizeLandmarks(selected);

  // Step 2: Build feature vector
  const features: number[] = [];

  // Add (x, y, z) for each identity landmark
  for (const pt of normalized) {
    features.push(pt.x, pt.y, 0); // We use 0 for z as a placeholder
    // In production, z depth from MediaPipe would be used here
  }

  // Step 3: Add statistical features for robustness
  const xs = normalized.map((p) => p.x);
  const ys = normalized.map((p) => p.y);

  features.push(...computeStats(xs));
  features.push(...computeStats(ys));

  // Step 4: Add pairwise distance features (key distances between facial features)
  // Distance between eye centers, eye-to-nose, mouth width, etc.
  const distanceFeatures = computeDistanceFeatures(normalized);
  features.push(...distanceFeatures);

  // Step 5: Pad or truncate to exactly TARGET_DIMENSION
  const embedding = padOrTruncate(features, TARGET_DIMENSION);

  // Step 6: L2 normalize
  return l2Normalize(embedding);
}

/**
 * Compute statistical features for an array of values.
 * Returns: [min, max, mean, std]
 */
function computeStats(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);

  return [min, max, mean, std];
}

/**
 * Compute key facial distance features for additional discriminative power.
 * Based on landmark indices from FACE_LANDMARK_INDICES.
 */
function computeDistanceFeatures(landmarks: Array<{ x: number; y: number }>): number[] {
  const features: number[] = [];

  // Eye-to-eye distance (index 33 = left eye outer, 263 = right eye outer)
  const leftEye = landmarks[0]; // first eye landmark
  const rightEye = landmarks[16]; // first right eye landmark
  if (leftEye && rightEye) {
    features.push(distance(leftEye, rightEye));
  }

  // Nose to left eye, nose to right eye
  const noseIdx = landmarks.length >= 50 ? 48 : 32; // nose bridge
  const nosePt = landmarks[noseIdx];
  if (nosePt && leftEye) features.push(distance(nosePt, leftEye));
  if (nosePt && rightEye) features.push(distance(nosePt, rightEye));

  // Mouth width
  const mouthLeft = landmarks[25]; // mouth corner
  const mouthRight = landmarks[29]; // mouth corner
  if (mouthLeft && mouthRight) features.push(distance(mouthLeft, mouthRight));

  // Mouth to nose
  if (nosePt && mouthLeft) features.push(distance(nosePt, mouthLeft));
  if (nosePt && mouthRight) features.push(distance(nosePt, mouthRight));

  return features;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Pad or truncate array to exactly target length.
 */
function padOrTruncate(arr: number[], targetLength: number): number[] {
  if (arr.length === targetLength) return arr;
  if (arr.length > targetLength) return arr.slice(0, targetLength);

  const padded = [...arr];
  while (padded.length < targetLength) {
    padded.push(0);
  }
  return padded;
}

/**
 * L2-normalize a vector (unit vector).
 */
function l2Normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((a, b) => a + b * b, 0));
  if (magnitude === 0) return vector;
  return vector.map((v) => v / magnitude);
}

/**
 * Convert raw MediaPipe FaceLandmarker result to Landmark3D array.
 */
export function extractLandmarks(
  faceLandmarks: Array<{ x: number; y: number; z?: number }>,
): Landmark3D[] {
  return faceLandmarks.map((lm) => ({
    x: lm.x,
    y: lm.y,
    z: lm.z ?? 0,
  }));
}

/**
 * Compare two embeddings using cosine similarity.
 * Returns a value between -1 and 1 (1 = identical).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;
  return dotProduct / magnitude;
}

/**
 * Generate a deterministic color from a patient ID for visual identification.
 */
export function patientIdToColor(patientId: string): string {
  let hash = 0;
  for (let i = 0; i < patientId.length; i++) {
    hash = (hash << 5) - hash + patientId.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}
