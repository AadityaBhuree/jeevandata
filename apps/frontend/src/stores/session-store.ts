import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type SessionStatus =
  | 'idle'
  | 'detecting'
  | 'face_matched'
  | 'context_loaded'
  | 'intake_in_progress'
  | 'transcribing'
  | 'brief_generated'
  | 'ready'
  | 'error';

export interface TranscriptEntry {
  id: string;
  speaker: 'patient' | 'ai' | 'system';
  text: string;
  timestamp: number;
}

interface PatientInfo {
  id: string;
  name: string;
  dob: string;
  mobile: string;
}

interface SessionState {
  sessionId: string | null;
  status: SessionStatus;
  patient: PatientInfo | null;
  isFaceMatched: boolean;
  isRecording: boolean;
  isAiThinking: boolean;
  transcripts: TranscriptEntry[];
  brief: Record<string, unknown> | null;
  error: string | null;

  // Actions
  setSessionId: (id: string) => void;
  setStatus: (status: SessionStatus) => void;
  setPatient: (patient: PatientInfo) => void;
  setFaceMatched: (matched: boolean) => void;
  setRecording: (recording: boolean) => void;
  setIsAiThinking: (thinking: boolean) => void;
  addTranscript: (entry: TranscriptEntry) => void;
  setBrief: (brief: Record<string, unknown>) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  status: 'idle' as SessionStatus,
  patient: null,
  isFaceMatched: false,
  isRecording: false,
  isAiThinking: false,
  transcripts: [],
  brief: null,
  error: null,
};

export const useSessionStore = create<SessionState>()(
  devtools(
    (set) => ({
      ...initialState,

      setSessionId: (id) => set({ sessionId: id }),

      setStatus: (status) => set({ status }),

      setPatient: (patient) => set({ patient }),

      setFaceMatched: (matched) => set({ isFaceMatched: matched }),

      setRecording: (recording) => set({ isRecording: recording }),

      setIsAiThinking: (thinking) => set({ isAiThinking: thinking }),

      addTranscript: (entry) =>
        set((state) => ({
          transcripts: [...state.transcripts, entry],
        })),

      setBrief: (brief) => set({ brief, status: 'ready' }),

      setError: (error) => set({ error, status: 'error' }),

      reset: () => set(initialState),
    }),
    { name: 'session-store' },
  ),
);
