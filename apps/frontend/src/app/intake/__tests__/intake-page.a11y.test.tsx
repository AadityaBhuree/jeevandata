import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import axe from 'axe-core';
import IntakeSessionPage from '../[sessionId]/page';
import { ThemeProvider } from '@/components/ui/theme-provider';

// ─── Module mocks — prevent camera / MediaPipe / WebSocket side effects ──

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ sessionId: 'test-session-1' }),
}));

vi.mock('@/hooks/useMobileDetection', () => ({
  useMobileDetection: () => ({
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
  }),
}));

vi.mock('@/hooks/useCamera', () => ({
  useCamera: () => ({
    videoRef: { current: null },
    isActive: false,
    error: null,
    startCamera: vi.fn().mockResolvedValue(undefined),
    stopCamera: vi.fn(),
    captureFrame: () => null,
    currentFacingMode: 'user',
    toggleCamera: vi.fn().mockResolvedValue(undefined),
    devices: [],
    hasMultipleCameras: false,
    enumerateCameras: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/hooks/useFaceDetection', () => ({
  useFaceDetection: () => ({
    result: null,
    isLoading: false,
    error: null,
    isFaceDetected: false,
    fps: 0,
    startDetection: vi.fn(),
    stopDetection: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFaceEmbedding', () => ({
  useFaceEmbedding: () => ({
    embedding: null,
    matchResult: null,
    isSearching: false,
    error: null,
    searchIdentity: vi.fn(),
    generateFromLandmarks: vi.fn(() => []),
    registerEmbedding: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/useLivenessDetection', () => ({
  useLivenessDetection: () => ({
    status: 'idle',
    blinkCount: 0,
    ear: 0,
    isAlive: false,
    startChallenge: vi.fn(),
    processFrame: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/useIntakeConversation', () => ({
  useIntakeConversation: () => ({
    turns: [],
    isAiThinking: false,
    isIntakeComplete: false,
    patientInput: '',
    setPatientInput: vi.fn(),
    sendPatientMessage: vi.fn(),
    startConversation: vi.fn(),
    completeIntake: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/services/socket', () => ({
  socketService: {
    isConnected: vi.fn(() => false),
    onConnectionChange: vi.fn(() => () => {}),
    joinSession: vi.fn(),
    leaveSession: vi.fn(),
    sendConversationTurn: vi.fn(),
    sendAudioChunk: vi.fn(),
    onSessionStatus: vi.fn(() => () => {}),
    onTranscriptChunk: vi.fn(() => () => {}),
    onBriefReady: vi.fn(() => () => {}),
    onFaceMatched: vi.fn(() => () => {}),
    onConversationTurn: vi.fn(() => () => {}),
    onError: vi.fn(() => () => {}),
  },
}));

// Rules that require real layout/color computation are unreliable in jsdom,
// which performs no rendering. Everything else is checked.
const JSDOM_UNAVAILABLE_RULES = {
  'color-contrast': { enabled: false },
  'target-size': { enabled: false },
};

function renderIntakePage() {
  return render(
    <ThemeProvider>
      <IntakeSessionPage />
    </ThemeProvider>,
  );
}

function formatViolations(results: axe.AxeResults): string {
  if (results.violations.length === 0) return 'No violations';
  return results.violations
    .map(
      (v) =>
        `• ${v.help} (${v.impact}) [${v.id}]\n` +
        v.nodes
          .map((n) => `    → ${n.target.join(' ')} — ${(n.failureSummary ?? '').split('\n')[0]}`)
          .join('\n'),
    )
    .join('\n');
}

describe('Intake page — axe-core accessibility scan', () => {
  beforeEach(() => {
    // The real app always renders inside layout.tsx which sets these;
    // jsdom's bare <html> has neither, so mirror the production document.
    document.documentElement.lang = 'en';
    document.title = 'Intake Session | Jeevandata';
  });

  it('has no detectable violations on initial render (camera phase)', async () => {
    renderIntakePage();

    // Smoke-check that the page actually rendered the header
    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();

    const results = await axe.run(document.body, {
      rules: JSDOM_UNAVAILABLE_RULES,
    });

    expect(results.violations, formatViolations(results)).toEqual([]);
  });

  it('has no detectable violations with the language menu open', async () => {
    renderIntakePage();

    fireEvent.click(screen.getByRole('button', { name: /select language/i }));
    expect(screen.getByRole('menu')).toBeDefined();

    const results = await axe.run(document.body, {
      rules: JSDOM_UNAVAILABLE_RULES,
    });

    expect(results.violations, formatViolations(results)).toEqual([]);
  });
});
