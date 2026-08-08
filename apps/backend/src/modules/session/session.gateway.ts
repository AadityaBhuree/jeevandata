import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { type Server, type Socket } from 'socket.io';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { PrismaService } from '../../prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { TranscriptionService } from '../transcription/transcription.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { MetricsService } from '../opentelemetry/metrics.service';
import type { SessionStatus } from '@jeevandata/shared-types';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/ws',
  transports: ['websocket', 'polling'],
})
export class SessionGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SessionGateway.name);

  @WebSocketServer()
  server!: Server;

  /** In-memory buffer for streaming audio chunks per session */
  private audioBuffers = new Map<string, { chunks: Buffer[]; lastChunkTime: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly transcriptionService: TranscriptionService,
    private readonly metrics: MetricsService,
  ) {}

  afterInit(): void {
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connected', { clientId: client.id });
    this.metrics.setActiveSessions(this.server.engine.clientsCount);
  }

  handleDisconnect(_client: Socket): void {
    this.logger.log(`Client disconnected: ${_client.id}`);
    this.metrics.setActiveSessions(this.server.engine.clientsCount);
    // Clean up any in-progress audio recordings for this client's sessions
    // Iterate over audioBuffers and remove entries that are stale (>30s old)
    const now = Date.now();
    for (const [sessionId, buffer] of this.audioBuffers.entries()) {
      if (now - buffer.lastChunkTime > 30_000) {
        this.audioBuffers.delete(sessionId);
        this.logger.debug(`Cleaned up stale audio buffer for session ${sessionId}`);
      }
    }
  }

  @SubscribeMessage('join:session')
  handleJoinSession(client: Socket, sessionId: string): void {
    client.join(`session:${sessionId}`);
    this.logger.debug(`Client ${client.id} joined session ${sessionId}`);
  }

  @SubscribeMessage('leave:session')
  handleLeaveSession(client: Socket, sessionId: string): void {
    client.leave(`session:${sessionId}`);
    this.logger.debug(`Client ${client.id} left session ${sessionId}`);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket): void {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  /**
   * Relay conversation turns between the frontend intake page and
   * any other clients connected to the same session (e.g. doctor dashboard).
   * Also persists the turn to the database so dashboards can access history.
   */
  @SubscribeMessage('conversation:turn')
  async handleConversationTurn(
    client: Socket,
    data: { sessionId: string; speaker: string; text: string },
  ): Promise<void> {
    // Broadcast to everyone in the session room EXCEPT the sender
    client.to(`session:${data.sessionId}`).emit('conversation:turn', {
      sessionId: data.sessionId,
      speaker: data.speaker,
      text: data.text,
      timestamp: new Date().toISOString(),
    });

    // Persist turn to the database for historical access
    try {
      await this.prisma.sessionTranscript.create({
        data: {
          sessionId: data.sessionId,
          speaker: data.speaker,
          text: data.text,
          timestampMs: BigInt(Date.now()),
        },
      });
    } catch (error) {
      // Log but never throw — WebSocket should be resilient
      this.logger.error(`Failed to persist conversation turn for session ${data.sessionId}`, error);
    }
  }

  /**
   * Receive streaming audio chunks from the frontend MediaRecorder.
   * Accumulates chunks in memory, then transcribes when recording stops.
   */
  @SubscribeMessage('audio:chunk')
  async handleAudioChunk(
    _client: Socket,
    data: {
      sessionId: string;
      data: Buffer;
      chunkIndex: number;
      isFinal: boolean;
      timestamp: number;
      /** ISO 639-1 language code (en/hi/mr/es) selected by the patient */
      language?: string;
    },
  ): Promise<void> {
    const { sessionId, data: chunkData, isFinal, language } = data;

    // Ensure a buffer exists for this session
    if (!this.audioBuffers.has(sessionId)) {
      this.audioBuffers.set(sessionId, {
        chunks: [],
        lastChunkTime: Date.now(),
      });
    }

    const buffer = this.audioBuffers.get(sessionId)!;
    buffer.chunks.push(Buffer.from(chunkData));
    buffer.lastChunkTime = Date.now();

    // When recording is complete, send to Whisper
    if (isFinal) {
      try {
        const completeAudio = Buffer.concat(buffer.chunks);
        this.audioBuffers.delete(sessionId);

        if (completeAudio.length === 0) {
          this.logger.warn(`Empty audio for session ${sessionId}`);
          return;
        }

        this.logger.debug(`Transcribing ${completeAudio.length} bytes for session ${sessionId}`);

        const result = await this.transcriptionService.transcribeBuffer(
          completeAudio,
          sessionId,
          language,
        );

        // Emit the transcription back to the session room
        this.emitTranscriptChunk(sessionId, {
          text: result.text,
          isFinal: true,
        });
      } catch (error) {
        this.logger.error(`Transcription failed for session ${sessionId}`, error);
        this.server.to(`session:${sessionId}`).emit('transcript:chunk', {
          event: 'transcript:chunk',
          sessionId,
          payload: {
            text: 'Transcription failed. Please try again.',
            isFinal: true,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // ─── Emitters ─────────────────────────────────────────────────

  emitSessionStatus(sessionId: string, status: SessionStatus): void {
    this.server.to(`session:${sessionId}`).emit('session:status', {
      event: 'session:status',
      sessionId,
      payload: { status },
      timestamp: new Date().toISOString(),
    });
  }

  emitConversationTurn(sessionId: string, speaker: string, text: string): void {
    this.server.to(`session:${sessionId}`).emit('conversation:turn', {
      event: 'conversation:turn',
      sessionId,
      payload: { speaker, text },
      timestamp: new Date().toISOString(),
    });

    // Also persist — this path is used by backend services (e.g. AiService)
    // and doesn't go through the @SubscribeMessage handler
    this.prisma.sessionTranscript
      .create({
        data: {
          sessionId,
          speaker,
          text,
          timestampMs: BigInt(Date.now()),
        },
      })
      .catch((error) => {
        this.logger.error(`Failed to persist conversation turn for session ${sessionId}`, error);
      });
  }

  emitTranscriptChunk(sessionId: string, chunk: { text: string; isFinal: boolean }): void {
    this.server.to(`session:${sessionId}`).emit('transcript:chunk', {
      event: 'transcript:chunk',
      sessionId,
      payload: chunk,
      timestamp: new Date().toISOString(),
    });
  }

  emitBriefReady(sessionId: string, briefId: string): void {
    this.server.to(`session:${sessionId}`).emit('brief:ready', {
      event: 'brief:ready',
      sessionId,
      payload: { briefId },
      timestamp: new Date().toISOString(),
    });
  }

  emitFaceMatched(sessionId: string, patientId: string, patientName: string): void {
    this.server.to(`session:${sessionId}`).emit('face:matched', {
      event: 'face:matched',
      sessionId,
      payload: { patientId, patientName },
      timestamp: new Date().toISOString(),
    });
  }

  emitError(sessionId: string, code: string, message: string): void {
    this.server.to(`session:${sessionId}`).emit('error', {
      event: 'error',
      sessionId,
      payload: { code, message },
      timestamp: new Date().toISOString(),
    });
  }
}
