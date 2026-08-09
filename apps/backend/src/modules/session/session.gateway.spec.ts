import { SessionGateway } from './session.gateway';
import type { Server, Socket } from 'socket.io';
import type { PrismaService } from '../../prisma/prisma.service';
import type { TranscriptionService } from '../transcription/transcription.service';
import type { MetricsService } from '../opentelemetry/metrics.service';
import type { SessionStatus } from '@jeevandata/shared-types';

// ─── Mocks ─────────────────────────────────────────────────────

const mockPrisma = {
  sessionTranscript: {
    create: jest.fn(),
  },
};

const mockTranscription = {
  transcribeBuffer: jest.fn(),
};

const mockMetrics = {
  setActiveSessions: jest.fn(),
};

/**
 * A Socket.IO server mock shaped like the object injected into a NAMESPACED
 * gateway at runtime. The critical property for the regression test:
 * a Namespace adapter exposes a `sockets` Map but has NO `.engine`.
 * (`.engine` exists only on the root `Server`.)
 */
function makeMockServer(socketCount = 0) {
  return {
    sockets: new Map(
      Array.from({ length: socketCount }, (_, i) => [`socket-${i}`, { id: `socket-${i}` }]),
    ),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  };
}

function makeMockClient(id = 'client-1') {
  return {
    id,
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  };
}

// ─── Tests ─────────────────────────────────────────────────────

describe('SessionGateway', () => {
  let gateway: SessionGateway;
  let server: ReturnType<typeof makeMockServer>;
  let client: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.sessionTranscript.create.mockResolvedValue({});
    mockTranscription.transcribeBuffer.mockResolvedValue({ text: 'hello', isFinal: true });

    server = makeMockServer(2);
    client = makeMockClient();

    gateway = new SessionGateway(
      mockPrisma as unknown as PrismaService,
      mockTranscription as unknown as TranscriptionService,
      mockMetrics as unknown as MetricsService,
    );
    gateway.server = server as unknown as Server;
  });

  // ─── Regression: namespace .engine crash ─────────────────────
  // The gateway runs on namespace '/ws', so @WebSocketServer() injects a
  // Namespace (no .engine). The old code `this.server.engine.clientsCount`
  // threw TypeError on EVERY connection. If anyone reintroduces `.engine`
  // access, these tests fail the same way production did.

  describe('namespace-safe connection handling (regression)', () => {
    it('should NOT access server.engine in handleConnection', () => {
      expect(() => gateway.handleConnection(client as unknown as Socket)).not.toThrow();

      // Count comes from the namespace's sockets Map, not engine.clientsCount
      expect(mockMetrics.setActiveSessions).toHaveBeenCalledWith(2);
      expect(client.emit).toHaveBeenCalledWith('connected', { clientId: 'client-1' });
    });

    it('should NOT access server.engine in handleDisconnect', () => {
      expect(() => gateway.handleDisconnect(client as unknown as Socket)).not.toThrow();

      expect(mockMetrics.setActiveSessions).toHaveBeenCalledWith(2);
    });

    it('should report the live socket count from the namespace map', () => {
      // Simulate a socket joining the namespace after startup
      server.sockets.set('socket-late', { id: 'socket-late' });

      gateway.handleConnection(client as unknown as Socket);

      expect(mockMetrics.setActiveSessions).toHaveBeenCalledWith(3);
    });
  });
  // ─── Audio chunk streaming ───────────────────────────────────

  describe('handleAudioChunk', () => {
    const chunk = (sessionId: string, index: number, isFinal: boolean) => ({
      sessionId,
      data: Buffer.from(`chunk-${index}`),
      chunkIndex: index,
      isFinal,
      timestamp: Date.now(),
    });

    it('should buffer non-final chunks and transcribe once on the final chunk', async () => {
      await gateway.handleAudioChunk(client as unknown as Socket, chunk('s1', 0, false));
      await gateway.handleAudioChunk(client as unknown as Socket, chunk('s1', 1, false));
      await gateway.handleAudioChunk(client as unknown as Socket, chunk('s1', 2, true));

      expect(mockTranscription.transcribeBuffer).toHaveBeenCalledTimes(1);
      const [buffer, sessionId] = mockTranscription.transcribeBuffer.mock.calls[0] as unknown as [
        Buffer,
        string,
      ];
      expect(sessionId).toBe('s1');
      expect(buffer.toString()).toBe('chunk-0chunk-1chunk-2');

      // Transcript emitted back to the session room
      expect(server.to).toHaveBeenCalledWith('session:s1');
      const emitMock = server.to.mock.results[0]!.value.emit;
      expect(emitMock).toHaveBeenCalledWith(
        'transcript:chunk',
        expect.objectContaining({
          event: 'transcript:chunk',
          sessionId: 's1',
          payload: { text: 'hello', isFinal: true },
        }),
      );
    });

    it('should forward the patient language to the transcription service', async () => {
      await gateway.handleAudioChunk(client as unknown as Socket, {
        ...chunk('s1', 0, true),
        language: 'hi',
      });

      expect(mockTranscription.transcribeBuffer).toHaveBeenCalledWith(
        expect.any(Buffer),
        's1',
        'hi',
      );
    });

    it('should emit a friendly failure when transcription throws', async () => {
      mockTranscription.transcribeBuffer.mockRejectedValue(new Error('whisper down'));

      await gateway.handleAudioChunk(client as unknown as Socket, chunk('s1', 0, true));

      expect(server.to).toHaveBeenCalledWith('session:s1');
      const emitMock = server.to.mock.results[0]!.value.emit;
      expect(emitMock).toHaveBeenCalledWith(
        'transcript:chunk',
        expect.objectContaining({
          payload: { text: 'Transcription failed. Please try again.', isFinal: true },
        }),
      );
    });

    it('should ignore empty audio instead of transcribing', async () => {
      await gateway.handleAudioChunk(client as unknown as Socket, {
        sessionId: 's1',
        data: Buffer.from(''),
        chunkIndex: 0,
        isFinal: true,
        timestamp: Date.now(),
      });

      expect(mockTranscription.transcribeBuffer).not.toHaveBeenCalled();
    });
  });

  // ─── Session rooms ───────────────────────────────────────────

  describe('session room handlers', () => {
    it('should join and leave a session room', () => {
      gateway.handleJoinSession(client as unknown as Socket, 's1');
      expect(client.join).toHaveBeenCalledWith('session:s1');

      gateway.handleLeaveSession(client as unknown as Socket, 's1');
      expect(client.leave).toHaveBeenCalledWith('session:s1');
    });

    it('should answer ping with pong', () => {
      gateway.handlePing(client as unknown as Socket);
      expect(client.emit).toHaveBeenCalledWith(
        'pong',
        expect.objectContaining({ timestamp: expect.any(String) }),
      );
    });
  });

  // ─── Conversation turns ──────────────────────────────────────

  describe('handleConversationTurn', () => {
    it('should broadcast the turn to the room and persist it', async () => {
      const turn = { sessionId: 's1', speaker: 'patient', text: 'I have a fever' };

      await gateway.handleConversationTurn(client as unknown as Socket, turn);

      expect(client.to).toHaveBeenCalledWith('session:s1');
      const emitMock = client.to.mock.results[0]!.value.emit;
      expect(emitMock).toHaveBeenCalledWith(
        'conversation:turn',
        expect.objectContaining({
          sessionId: 's1',
          speaker: 'patient',
          text: 'I have a fever',
        }),
      );

      expect(mockPrisma.sessionTranscript.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: 's1',
          speaker: 'patient',
          text: 'I have a fever',
          timestampMs: expect.any(BigInt),
        }),
      });
    });

    it('should not throw when persisting fails', async () => {
      mockPrisma.sessionTranscript.create.mockRejectedValue(new Error('db down'));

      await expect(
        gateway.handleConversationTurn(client as unknown as Socket, {
          sessionId: 's1',
          speaker: 'patient',
          text: 'hello',
        }),
      ).resolves.not.toThrow();
    });
  });
  // ─── Stale audio buffer cleanup ──────────────────────────────

  describe('handleDisconnect cleanup', () => {
    it('should remove audio buffers stale for more than 30s', async () => {
      const now = Date.now();
      const stale = now - 31_000;

      // Seed two buffers via the public handler, then age one artificially
      await gateway.handleAudioChunk(client as unknown as Socket, {
        sessionId: 's1',
        data: Buffer.from('a'),
        chunkIndex: 0,
        isFinal: false,
        timestamp: now,
      });
      await gateway.handleAudioChunk(client as unknown as Socket, {
        sessionId: 's2',
        data: Buffer.from('b'),
        chunkIndex: 0,
        isFinal: false,
        timestamp: stale,
      });
      // Age s2's buffer so the disconnect sweep removes it
      const buffers = (
        gateway as unknown as {
          audioBuffers: Map<string, { chunks: Buffer[]; lastChunkTime: number }>;
        }
      ).audioBuffers;
      buffers.get('s2')!.lastChunkTime = stale;

      gateway.handleDisconnect(client as unknown as Socket);

      expect(buffers.has('s1')).toBe(true);
      expect(buffers.has('s2')).toBe(false);
    });
  });

  // ─── Emitters ────────────────────────────────────────────────

  describe('emitters', () => {
    const expectEmittedTo = (room: string, event: string, payloadMatcher: object) => {
      expect(server.to).toHaveBeenCalledWith(room);
      const emitMock = server.to.mock.results[server.to.mock.results.length - 1]!.value.emit;
      expect(emitMock).toHaveBeenCalledWith(event, expect.objectContaining(payloadMatcher));
    };

    it('emitSessionStatus', () => {
      gateway.emitSessionStatus('s1', 'INTAKE_IN_PROGRESS' as SessionStatus);
      expectEmittedTo('session:s1', 'session:status', {
        event: 'session:status',
        sessionId: 's1',
        payload: { status: 'INTAKE_IN_PROGRESS' },
      });
    });

    it('emitTranscriptChunk', () => {
      gateway.emitTranscriptChunk('s1', { text: 'hi', isFinal: true });
      expectEmittedTo('session:s1', 'transcript:chunk', {
        event: 'transcript:chunk',
        sessionId: 's1',
        payload: { text: 'hi', isFinal: true },
      });
    });

    it('emitBriefReady', () => {
      gateway.emitBriefReady('s1', 'brief-1');
      expectEmittedTo('session:s1', 'brief:ready', {
        event: 'brief:ready',
        sessionId: 's1',
        payload: { briefId: 'brief-1' },
      });
    });

    it('emitFaceMatched', () => {
      gateway.emitFaceMatched('s1', 'patient-1', 'Ravi');
      expectEmittedTo('session:s1', 'face:matched', {
        event: 'face:matched',
        sessionId: 's1',
        payload: { patientId: 'patient-1', patientName: 'Ravi' },
      });
    });

    it('emitError', () => {
      gateway.emitError('s1', 'FACE_NOT_FOUND', 'No match');
      expectEmittedTo('session:s1', 'error', {
        event: 'error',
        sessionId: 's1',
        payload: { code: 'FACE_NOT_FOUND', message: 'No match' },
      });
    });
  });
});
