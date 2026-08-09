'use client';

import { useEffect, useRef } from 'react';

interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface FaceDetectionCanvasProps {
  landmarks: Landmark[] | null;
  videoWidth: number;
  videoHeight: number;
  isFaceDetected: boolean;
  matchColor?: string;
  drawLandmarks?: boolean;
  drawConnections?: boolean;
  drawBoundingBox?: boolean;
  className?: string;
}

// MediaPipe face mesh connections (simplified — key connections only)
const FACE_CONNECTIONS: [number, number][] = [
  // Left eye
  [33, 7],
  [7, 163],
  [163, 144],
  [144, 145],
  [145, 153],
  [153, 154],
  [154, 155],
  [155, 133],
  [133, 173],
  [173, 157],
  [157, 158],
  [158, 159],
  [159, 160],
  [160, 161],
  [161, 246],
  [246, 33],
  // Right eye
  [362, 382],
  [382, 381],
  [381, 380],
  [380, 374],
  [374, 373],
  [373, 390],
  [390, 249],
  [249, 263],
  [263, 466],
  [466, 388],
  [388, 387],
  [387, 386],
  [386, 385],
  [385, 384],
  [384, 398],
  [398, 362],
  // Left eyebrow
  [46, 53],
  [53, 52],
  [52, 65],
  [65, 55],
  [55, 70],
  [70, 63],
  [63, 105],
  [105, 66],
  // Right eyebrow
  [276, 283],
  [283, 282],
  [282, 295],
  [295, 285],
  [285, 300],
  [300, 293],
  [293, 334],
  [334, 296],
  // Nose bridge
  [168, 6],
  [6, 197],
  [197, 195],
  [195, 5],
  [5, 4],
  [4, 45],
  [45, 44],
  // Nose tip
  [1, 2],
  [2, 98],
  [98, 97],
  // Mouth outer
  [61, 146],
  [146, 91],
  [91, 181],
  [181, 84],
  [84, 17],
  [17, 314],
  [314, 405],
  [405, 321],
  [321, 375],
  [375, 291],
  [291, 409],
  [409, 270],
  [270, 269],
  [269, 267],
  [267, 0],
  [0, 37],
  [37, 39],
  [39, 40],
  [40, 185],
  [185, 61],
  // Mouth inner
  [78, 191],
  [191, 80],
  [80, 81],
  [81, 82],
  [82, 13],
  [13, 311],
  [311, 310],
  [310, 415],
  [415, 308],
  [308, 324],
  [324, 318],
  [318, 402],
  [402, 317],
  [317, 14],
  [14, 87],
  [87, 178],
  [178, 88],
  [88, 95],
  [95, 78],
  // Jaw
  [172, 136],
  [136, 150],
  [150, 149],
  [149, 176],
  [176, 148],
  [148, 152],
  [152, 377],
  [377, 400],
  [400, 378],
  [378, 379],
  [379, 365],
  [365, 397],
  [397, 435],
];

export function FaceDetectionCanvas({
  landmarks,
  videoWidth,
  videoHeight,
  isFaceDetected,
  matchColor = '#22c55e',
  drawLandmarks = true,
  drawConnections = true,
  drawBoundingBox = true,
  className,
}: FaceDetectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoWidth;
    canvas.height = videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!landmarks || landmarks.length === 0) return;

    // Scale landmarks to canvas pixel coordinates
    const scaled = landmarks.map((lm) => ({
      x: lm.x * canvas.width,
      y: lm.y * canvas.height,
    }));

    // ─── Bounding Box ──────────────────────────────────────────
    if (drawBoundingBox) {
      const xs = scaled.map((p) => p.x);
      const ys = scaled.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const padding = 10;

      ctx.strokeStyle = matchColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(
        minX - padding,
        minY - padding,
        maxX - minX + padding * 2,
        maxY - minY + padding * 2,
      );

      // Corner accents
      const cornerLen = 15;
      ctx.strokeStyle = matchColor;
      ctx.lineWidth = 3;

      // Top-left
      ctx.beginPath();
      ctx.moveTo(minX - padding, minY - padding + cornerLen);
      ctx.lineTo(minX - padding, minY - padding);
      ctx.lineTo(minX - padding + cornerLen, minY - padding);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(maxX + padding - cornerLen, minY - padding);
      ctx.lineTo(maxX + padding, minY - padding);
      ctx.lineTo(maxX + padding, minY - padding + cornerLen);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(minX - padding, maxY + padding - cornerLen);
      ctx.lineTo(minX - padding, maxY + padding);
      ctx.lineTo(minX - padding + cornerLen, maxY + padding);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(maxX + padding - cornerLen, maxY + padding);
      ctx.lineTo(maxX + padding, maxY + padding);
      ctx.lineTo(maxX + padding, maxY + padding - cornerLen);
      ctx.stroke();
    }

    // ─── Face Mesh Connections ─────────────────────────────────
    if (drawConnections && isFaceDetected) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;

      for (const [i, j] of FACE_CONNECTIONS) {
        const p1 = scaled[i];
        const p2 = scaled[j];
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    // ─── Landmark Points ───────────────────────────────────────
    if (drawLandmarks) {
      for (const pt of scaled) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();
      }

      // Highlight key feature points
      const highlightIndices = [1, 33, 263, 61, 291, 168, 152];
      for (const idx of highlightIndices) {
        const pt = scaled[idx];
        if (pt) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = matchColor;
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
  }, [
    landmarks,
    videoWidth,
    videoHeight,
    isFaceDetected,
    matchColor,
    drawLandmarks,
    drawConnections,
    drawBoundingBox,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? 'pointer-events-none absolute inset-0 h-full w-full'}
      style={{ objectFit: 'cover' }}
    />
  );
}
