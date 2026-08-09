/**
 * Face geometry utilities for MediaPipe FaceLandmarker.
 *
 * MediaPipe returns 478 face landmarks, each with normalized (x, y, z) coordinates.
 * We use specific landmark indices for:
 *   - Face alignment (eyes, nose tip)
 *   - Liveness detection (eye aspect ratio)
 *   - Embedding generation (identity-discriminative landmarks)
 */

// ─── Landmark Index Constants ───────────────────────────────────
// Based on MediaPipe canonical face model (478 landmarks)

export const FACE_LANDMARK_INDICES = {
  // Eye landmarks (iris + contour)
  LEFT_EYE: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  RIGHT_EYE: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  LEFT_IRIS: [468, 469, 470, 471],
  RIGHT_IRIS: [473, 474, 475, 476],
  LEFT_EYEBROW: [46, 53, 52, 65, 55, 70, 63, 105, 66, 107],
  RIGHT_EYEBROW: [276, 283, 282, 295, 285, 300, 293, 334, 296, 336],

  // Nose landmarks
  NOSE_TIP: 1,
  NOSE: [
    1, 2, 98, 97, 5, 4, 45, 44, 195, 196, 6, 168, 19, 240, 279, 429, 436, 437, 438, 439, 448, 449,
    450, 451, 452, 453,
  ],
  NOSE_BRIDGE: [6, 168, 197, 195, 5, 4, 45, 44],

  // Mouth landmarks
  MOUTH_INNER: [
    78, 191, 80, 81, 82, 13, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
  ],
  MOUTH_OUTER: [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
  ],
  LIPS_UPPER: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
  LIPS_LOWER: [146, 91, 181, 84, 17, 314, 405, 321, 375, 291],

  // Jaw and face contour
  JAW: [
    172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 435, 367, 364, 394, 395, 369,
    396, 173, 137, 177, 215, 138, 135, 210, 212, 213, 192, 203, 211, 208, 200, 421, 418, 424, 422,
    432, 436, 416, 434, 430, 431, 433, 439, 427, 411, 376, 401, 435,
  ],

  // Key identity landmarks (subset used for embedding)
  IDENTITY_LANDMARKS: [
    // Eyes (32 landmarks)
    33,
    7,
    163,
    144,
    145,
    153,
    154,
    155,
    133,
    173,
    157,
    158,
    159,
    160,
    161,
    246, // left eye
    362,
    382,
    381,
    380,
    374,
    373,
    390,
    249,
    263,
    466,
    388,
    387,
    386,
    385,
    384,
    398, // right eye
    // Eyebrows (20 landmarks)
    46,
    53,
    52,
    65,
    55,
    70,
    63,
    105,
    66,
    107,
    276,
    283,
    282,
    295,
    285,
    300,
    293,
    334,
    296,
    336,
    // Nose (26 landmarks)
    1,
    2,
    98,
    97,
    5,
    4,
    45,
    44,
    195,
    196,
    6,
    168,
    19,
    240,
    279,
    429,
    436,
    437,
    438,
    439,
    448,
    449,
    450,
    451,
    452,
    453,
    // Mouth (38 landmarks)
    61,
    146,
    91,
    181,
    84,
    17,
    314,
    405,
    321,
    375,
    291,
    409,
    270,
    269,
    267,
    0,
    37,
    39,
    40,
    185,
    78,
    191,
    80,
    81,
    82,
    13,
    311,
    310,
    415,
    308,
    324,
    318,
    402,
    317,
    14,
    87,
    178,
    88,
    95,
    // Jaw contour (16 key points)
    172,
    150,
    152,
    377,
    365,
    367,
    394,
    396,
    137,
    215,
    210,
    213,
    211,
    200,
    136,
    148,
  ],
} as const;

// Total identity landmarks: 32 + 20 + 26 + 38 + 16 = 132 landmarks
// 132 * 3 = 396 values → pad to 512

// ─── Eye Aspect Ratio (EAR) for Blink Detection ────────────────

interface Point2D {
  x: number;
  y: number;
}

/**
 * Calculate Eye Aspect Ratio (EAR) from eye landmarks.
 * EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
 *
 * A typical EAR is ~0.25-0.3. A blink is detected when EAR drops
 * below ~0.18-0.2 (threshold depends on face distance).
 */
export function calculateEAR(eyeLandmarks: Point2D[], rightIdx: number[] = []): number {
  const pts = rightIdx.length > 0 ? rightIdx.map((i) => eyeLandmarks[i]!) : eyeLandmarks;

  // Using MediaPipe eye landmark mapping:
  // p1 = landmark[159] (left) or [386] (right) — top
  // p2 = landmark[158] (left) or [385] (right) — top outer
  // p3 = landmark[153] (left) or [374] (right) — top inner
  // p4 = landmark[145] (left) or [380] (right) — bottom
  // p5 = landmark[144] (left) or [373] (right) — bottom inner
  // p6 = landmark[163] (left) or [381] (right) — bottom outer

  // Fallback: use first 6 landmarks
  const p1 = pts[1]!;
  const p2 = pts[2]!;
  const p3 = pts[3]!;
  const p4 = pts[4]!;
  const p5 = pts[5]!;
  const p6 = pts[0]!;

  const verticalA = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const verticalB = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  const horizontal = Math.hypot(p1.x - p4.x, p1.y - p4.y);

  if (horizontal === 0) return 0;
  return (verticalA + verticalB) / (2 * horizontal);
}

export function calculateBothEyesEAR(landmarks: Point2D[]): {
  leftEAR: number;
  rightEAR: number;
  avgEAR: number;
} {
  const leftEyeIndices = FACE_LANDMARK_INDICES.LEFT_EYE;
  const rightEyeIndices = FACE_LANDMARK_INDICES.RIGHT_EYE;

  const leftEye = leftEyeIndices.map((i) => landmarks[i]!);
  const rightEye = rightEyeIndices.map((i) => landmarks[i]!);

  const leftEAR = calculateEAR(leftEye);
  const rightEAR = calculateEAR(rightEye);

  return {
    leftEAR,
    rightEAR,
    avgEAR: (leftEAR + rightEAR) / 2,
  };
}

// ─── Face Alignment ─────────────────────────────────────────────

export interface AlignedFace {
  /** The aligned face image data */
  imageData: ImageData;
  /** The affine transform matrix used */
  transform: { a: number; b: number; c: number; d: number; e: number; f: number };
}

/**
 * Compute eye center from landmarks.
 */
function getEyeCenter(landmarks: Point2D[], indices: number[]): Point2D {
  let x = 0;
  let y = 0;
  for (const idx of indices) {
    const pt = landmarks[idx]!;
    x += pt.x;
    y += pt.y;
  }
  return { x: x / indices.length, y: y / indices.length };
}

/**
 * Align face based on eye positions using affine transformation.
 * Rotates and scales so eyes are horizontal and at canonical positions.
 */
export function alignFace(
  image: HTMLCanvasElement | HTMLVideoElement,
  landmarks: Point2D[],
  outputSize = 112,
): AlignedFace | null {
  const leftEyeCenter = getEyeCenter(landmarks, FACE_LANDMARK_INDICES.LEFT_EYE.slice(0, 8));
  const rightEyeCenter = getEyeCenter(landmarks, FACE_LANDMARK_INDICES.RIGHT_EYE.slice(0, 8));

  // Calculate angle between eyes
  const dy = rightEyeCenter.y - leftEyeCenter.y;
  const dx = rightEyeCenter.x - leftEyeCenter.x;
  const angle = -Math.atan2(dy, dx);

  // Calculate distance between eyes
  const eyeDist = Math.hypot(dx, dy);

  // Scale factor to map eye distance to canonical distance
  const targetEyeDist = outputSize * 0.35; // ~39px for 112x112
  const scale = targetEyeDist / eyeDist;

  // Center point between eyes
  const centerX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
  const centerY = (leftEyeCenter.y + rightEyeCenter.y) / 2;

  // Normalize center to [0, 1] range
  const imgCenterX = image.width / 2;
  const imgCenterY = image.height / 2;

  // Build affine transform
  const cosA = Math.cos(angle) * scale;
  const sinA = Math.sin(angle) * scale;

  const a = cosA;
  const b = -sinA;
  const c = imgCenterX - centerX * cosA * scale + centerY * sinA * scale;
  const d = sinA;
  const e = cosA;
  const f = imgCenterY - centerX * sinA * scale - centerY * cosA * scale;

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.setTransform(a, d, b, e, c, f);
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, outputSize, outputSize);

  return {
    imageData,
    transform: { a, b, c, d, e, f },
  };
}

// ─── Normalize Landmarks ───────────────────────────────────────

/**
 * Normalize landmarks relative to a reference point (nose tip) and scale.
 * This makes the embedding invariant to face position in frame.
 */
export function normalizeLandmarks(
  landmarks: Point2D[],
  referenceIndex = 1 as const, // nose tip
): Point2D[] {
  const ref = landmarks[referenceIndex];
  if (!ref) return landmarks;

  return landmarks.map((pt) => ({
    x: pt.x - ref.x,
    y: pt.y - ref.y,
  }));
}

/**
 * Select identity-discriminative landmarks for embedding generation.
 */
export function selectIdentityLandmarks(landmarks: Point2D[]): Point2D[] {
  return FACE_LANDMARK_INDICES.IDENTITY_LANDMARKS.map((idx) => landmarks[idx]!);
}

/**
 * Check if landmarks are valid (not all zeros, has reasonable spread).
 */
export function validateLandmarks(landmarks: Point2D[]): boolean {
  if (landmarks.length < 100) return false;

  // Check that not all points are at origin
  const hasNonZero = landmarks.some((pt) => Math.abs(pt.x) > 0.001 || Math.abs(pt.y) > 0.001);
  if (!hasNonZero) return false;

  // Check that points are spread out (not degenerate)
  const xs = landmarks.map((p) => p.x);
  const ys = landmarks.map((p) => p.y);
  const xRange = Math.max(...xs) - Math.min(...xs);
  const yRange = Math.max(...ys) - Math.min(...ys);

  // For normalized face, landmarks should span at least 0.1 in each axis
  if (xRange < 0.05 || yRange < 0.05) return false;

  return true;
}
