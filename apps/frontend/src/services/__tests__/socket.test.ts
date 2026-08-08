import { describe, it, expect, beforeEach, vi } from 'vitest';
import { socketService } from '../socket';

// ─── Mock socket.io-client ────────────────────────────────────
// vi.mock() is hoisted, so factory variables must use vi.hoisted().

const { mockSocket, mockIo } = vi.hoisted(() => {
  const mockSocket = {
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    connected: false,
    id: null as string | null,
  };

  const mockIo = vi.fn(() => mockSocket);

  return { mockSocket, mockIo };
});

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

// ─── Tests ────────────────────────────────────────────────────

describe('SocketService', () => {
  beforeEach(() => {
    // Reset singleton internal state before clearing mocks
    socketService.disconnect();
    (socketService as unknown as { socket: null }).socket = null;
    // Reset socket state
    mockSocket.connected = false;
    mockSocket.id = null;
    // Clear all mock call counts AFTER cleanup
    vi.clearAllMocks();
  });

  // ─── connect ───────────────────────────────────────────────

  describe('connect', () => {
    it('should create a new socket connection with correct URL and options', () => {
      socketService.connect();

      expect(mockIo).toHaveBeenCalledWith('http://localhost:4000/ws', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });
    });

    it('should register default event handlers (connect, disconnect, connect_error)', () => {
      socketService.connect();

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    });

    it('should return existing socket if already connected', () => {
      mockSocket.connected = true;

      const result1 = socketService.connect();
      const result2 = socketService.connect();

      // io should only be called once
      expect(mockIo).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2);
    });

    it('should re-attach saved listeners on reconnect', () => {
      // First connection — register a listener
      socketService.connect();
      const callback = vi.fn();
      socketService.onSessionStatus(callback);

      // Clear the mock to reset call counts
      vi.clearAllMocks();

      // Disconnect and reconnect
      mockSocket.connected = true;
      socketService.disconnect();
      mockSocket.connected = false;
      socketService.connect();

      // The listener should be re-attached to the new socket
      expect(mockSocket.on).toHaveBeenCalledWith('session:status', callback);
    });
  });

  // ─── disconnect ────────────────────────────────────────────

  describe('disconnect', () => {
    it('should disconnect the socket and nullify it', () => {
      socketService.connect();
      socketService.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should not throw when called without an active socket', () => {
      expect(() => socketService.disconnect()).not.toThrow();
    });
  });

  // ─── joinSession / leaveSession ────────────────────────────

  describe('joinSession / leaveSession', () => {
    it('should emit join:session event', () => {
      socketService.connect();
      socketService.joinSession('session-123');

      expect(mockSocket.emit).toHaveBeenCalledWith('join:session', 'session-123');
    });

    it('should emit leave:session event', () => {
      socketService.connect();
      socketService.leaveSession('session-456');

      expect(mockSocket.emit).toHaveBeenCalledWith('leave:session', 'session-456');
    });

    it('should not throw when called without connection', () => {
      expect(() => socketService.joinSession('s1')).not.toThrow();
      expect(() => socketService.leaveSession('s1')).not.toThrow();
    });
  });

  // ─── Event Listeners (on*) ─────────────────────────────────

  describe('event listeners', () => {
    beforeEach(() => {
      socketService.connect();
    });

    it('onSessionStatus should register session:status listener', () => {
      const callback = vi.fn();

      socketService.onSessionStatus(callback);

      expect(mockSocket.on).toHaveBeenCalledWith('session:status', callback);
    });

    it('onSessionStatus should return unsubscribe function', () => {
      const callback = vi.fn();

      const unsubscribe = socketService.onSessionStatus(callback);
      unsubscribe();

      expect(mockSocket.off).toHaveBeenCalledWith('session:status', callback);
    });

    it('onTranscriptChunk should register transcript:chunk listener', () => {
      const callback = vi.fn();

      socketService.onTranscriptChunk(callback);

      expect(mockSocket.on).toHaveBeenCalledWith('transcript:chunk', callback);
    });

    it('onBriefReady should register brief:ready listener', () => {
      const callback = vi.fn();

      socketService.onBriefReady(callback);

      expect(mockSocket.on).toHaveBeenCalledWith('brief:ready', callback);
    });

    it('onFaceMatched should register face:matched listener', () => {
      const callback = vi.fn();

      socketService.onFaceMatched(callback);

      expect(mockSocket.on).toHaveBeenCalledWith('face:matched', callback);
    });

    it('onConversationTurn should register conversation:turn listener', () => {
      const callback = vi.fn();

      socketService.onConversationTurn(callback);

      expect(mockSocket.on).toHaveBeenCalledWith('conversation:turn', callback);
    });

    it('onError should register error listener', () => {
      const callback = vi.fn();

      socketService.onError(callback);

      expect(mockSocket.on).toHaveBeenCalledWith('error', callback);
    });

    it('should allow multiple listeners on the same event', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      socketService.onSessionStatus(cb1);
      socketService.onSessionStatus(cb2);

      // Each callback should be registered separately
      expect(mockSocket.on).toHaveBeenCalledWith('session:status', cb1);
      expect(mockSocket.on).toHaveBeenCalledWith('session:status', cb2);
    });

    it('unsubscribe should remove only the specific callback', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const unsub1 = socketService.onSessionStatus(cb1);
      socketService.onSessionStatus(cb2);

      unsub1();

      // cb1 should be removed
      expect(mockSocket.off).toHaveBeenCalledWith('session:status', cb1);
      // cb2 should still be registered
      expect(mockSocket.off).not.toHaveBeenCalledWith('session:status', cb2);
    });
  });

  // ─── sendConversationTurn ─────────────────────────────────

  describe('sendConversationTurn', () => {
    beforeEach(() => {
      socketService.connect();
    });

    it('should emit conversation:turn with correct payload', () => {
      socketService.sendConversationTurn('s1', 'patient', 'I have a headache');

      expect(mockSocket.emit).toHaveBeenCalledWith('conversation:turn', {
        sessionId: 's1',
        speaker: 'patient',
        text: 'I have a headache',
        timestamp: expect.any(String),
      });
    });

    it('should include ISO timestamp', () => {
      socketService.sendConversationTurn('s1', 'ai', 'How long?');

      const payload = mockSocket.emit.mock.calls[0]![1] as Record<string, unknown>;
      expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should not throw when called without connection', () => {
      socketService.disconnect();

      expect(() => socketService.sendConversationTurn('s1', 'patient', 'Hello')).not.toThrow();
    });
  });

  // ─── sendAudioChunk ────────────────────────────────────────

  describe('sendAudioChunk', () => {
    beforeEach(() => {
      socketService.connect();
    });

    it('should emit audio:chunk with correct payload', () => {
      const buffer = new ArrayBuffer(16);

      socketService.sendAudioChunk('s1', buffer, 0, false);

      expect(mockSocket.emit).toHaveBeenCalledWith('audio:chunk', {
        sessionId: 's1',
        data: buffer,
        chunkIndex: 0,
        isFinal: false,
        timestamp: expect.any(Number),
      });
    });

    it('should include the patient language when provided', () => {
      const buffer = new ArrayBuffer(16);

      socketService.sendAudioChunk('s1', buffer, 1, false, 'hi');

      expect(mockSocket.emit).toHaveBeenCalledWith('audio:chunk', {
        sessionId: 's1',
        data: buffer,
        chunkIndex: 1,
        isFinal: false,
        timestamp: expect.any(Number),
        language: 'hi',
      });
    });

    it('should omit language from the payload when not selected', () => {
      const buffer = new ArrayBuffer(16);

      socketService.sendAudioChunk('s1', buffer, 2, true);

      const payload = mockSocket.emit.mock.calls[0]![1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('language');
    });

    it('should mark the last chunk with isFinal=true', () => {
      const buffer = new ArrayBuffer(8);

      socketService.sendAudioChunk('s1', buffer, 5, true);

      const payload = mockSocket.emit.mock.calls[0]![1] as Record<string, unknown>;
      expect(payload.isFinal).toBe(true);
      expect(payload.chunkIndex).toBe(5);
    });

    it('should not throw when called without connection', () => {
      socketService.disconnect();

      expect(() => socketService.sendAudioChunk('s1', new ArrayBuffer(4), 0, true)).not.toThrow();
    });
  });
});
