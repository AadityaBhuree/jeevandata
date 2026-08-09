import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type DetectionStatus =
  | 'idle'
  | 'loading'
  | 'detecting'
  | 'matched'
  | 'no_match'
  | 'error'
  | 'liveness_check';

export type LivenessStatus =
  | 'idle'
  | 'waiting_for_blink'
  | 'blink_detected'
  | 'verified'
  | 'failed';

export interface DetectedFace {
  id: string;
  box: { x: number; y: number; width: number; height: number };
  landmarks: Array<{ x: number; y: number; z: number }>;
  confidence: number;
}

export interface IdentityMatch {
  patientId: string;
  score: number;
  patientName?: string;
  isNewPatient: boolean;
}

interface FaceState {
  status: DetectionStatus;
  isCameraActive: boolean;
  faces: DetectedFace[];
  confidence: number;
  fps: number;
  embedding: number[] | null;
  matchResult: IdentityMatch | null;
  livenessStatus: LivenessStatus;
  livenessEar: number;
  livenessBlinkCount: number;
  isAlive: boolean;
  error: string | null;

  // Actions
  setStatus: (status: DetectionStatus) => void;
  setCameraActive: (active: boolean) => void;
  setFaces: (faces: DetectedFace[]) => void;
  setConfidence: (confidence: number) => void;
  setFps: (fps: number) => void;
  setEmbedding: (embedding: number[] | null) => void;
  setMatchResult: (result: IdentityMatch | null) => void;
  setLivenessStatus: (status: LivenessStatus) => void;
  setLivenessEar: (ear: number) => void;
  setLivenessBlinkCount: (count: number) => void;
  setIsAlive: (alive: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as DetectionStatus,
  isCameraActive: false,
  faces: [],
  confidence: 0,
  fps: 0,
  embedding: null as number[] | null,
  matchResult: null as IdentityMatch | null,
  livenessStatus: 'idle' as LivenessStatus,
  livenessEar: 0,
  livenessBlinkCount: 0,
  isAlive: false,
  error: null,
};

export const useFaceStore = create<FaceState>()(
  devtools(
    (set) => ({
      ...initialState,

      setStatus: (status) => set({ status }),

      setCameraActive: (active) => set({ isCameraActive: active }),

      setFaces: (faces) => {
        // Auto-update confidence from the first face
        const confidence = faces.length > 0 ? faces[0]!.confidence : 0;
        set({ faces, confidence });
      },

      setConfidence: (confidence) => set({ confidence }),

      setFps: (fps) => set({ fps }),

      setEmbedding: (embedding) => set({ embedding }),

      setMatchResult: (result) => set({ matchResult: result }),

      setLivenessStatus: (status) => set({ livenessStatus: status }),

      setLivenessEar: (ear) => set({ livenessEar: ear }),

      setLivenessBlinkCount: (count) => set({ livenessBlinkCount: count }),

      setIsAlive: (alive) => set({ isAlive: alive }),

      setError: (error) => set({ error, status: error ? 'error' : initialState.status }),

      reset: () => set(initialState),
    }),
    { name: 'face-store' },
  ),
);
