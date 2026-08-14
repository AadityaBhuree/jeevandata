import { io, type Socket } from 'socket.io-client';
import { WS_BASE_URL } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth-store';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private connected = false;
  private connectionListeners = new Set<(connected: boolean) => void>();

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    // Send the access token in the Socket.IO handshake so the backend can
    // authenticate the connection — the gateway rejects sockets without a
    // valid JWT before they can join session rooms or receive PHI.
    const token = useAuthStore.getState().accessToken;

    this.socket = io(`${WS_BASE_URL}/ws`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: token ? { token } : undefined,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.connectionListeners.forEach((cb) => cb(true));
      logger.info('Socket connected', { socketId: this.socket?.id });
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      this.connectionListeners.forEach((cb) => cb(false));
      logger.info('Socket disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      this.connected = false;
      this.connectionListeners.forEach((cb) => cb(false));
      logger.error('Socket connection error', error, { socketId: this.socket?.id });
    });

    // Backend rejects unauthenticated connections — surface it so the caller
    // knows the socket never joined any session rooms.
    this.socket.on('auth:error', (data: { code: string; message: string }) => {
      logger.warn('Socket auth rejected', { code: data.code, message: data.message });
    });

    // Re-attach all registered listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((cb) => {
        this.socket?.on(event, cb);
      });
    });

    return this.socket;
  }

  disconnect(): void {
    this.connected = false;
    this.connectionListeners.forEach((cb) => cb(false));
    this.socket?.disconnect();
    this.socket = null;
  }

  /** Current realtime connection state (true = connected to the WS gateway). */
  isConnected(): boolean {
    return this.connected;
  }

  /** Subscribe to connection-state changes. Returns an unsubscribe fn. */
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionListeners.add(callback);
    callback(this.connected);
    return () => this.connectionListeners.delete(callback);
  }

  joinSession(sessionId: string): void {
    this.socket?.emit('join:session', sessionId);
  }

  leaveSession(sessionId: string): void {
    this.socket?.emit('leave:session', sessionId);
  }

  onSessionStatus(callback: (data: { status: string }) => void): () => void {
    return this.on('session:status', callback);
  }

  onTranscriptChunk(callback: (data: { text: string; isFinal: boolean }) => void): () => void {
    return this.on('transcript:chunk', callback);
  }

  onBriefReady(callback: (data: { briefId: string }) => void): () => void {
    return this.on('brief:ready', callback);
  }

  onFaceMatched(callback: (data: { patientId: string; patientName: string }) => void): () => void {
    return this.on('face:matched', callback);
  }

  /** Send a conversation turn (patient or AI message) via WebSocket */
  sendConversationTurn(sessionId: string, speaker: 'patient' | 'ai', text: string): void {
    this.socket?.emit('conversation:turn', {
      sessionId,
      speaker,
      text,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send an audio chunk for Whisper transcription.
   * @param language ISO 639-1 code (en/hi/mr/es) selected by the patient —
   * forwarded to whisper.cpp per request when present.
   */
  sendAudioChunk(
    sessionId: string,
    data: ArrayBuffer,
    chunkIndex: number,
    isFinal: boolean,
    language?: string,
  ): void {
    this.socket?.emit('audio:chunk', {
      sessionId,
      data,
      chunkIndex,
      isFinal,
      timestamp: Date.now(),
      ...(language ? { language } : {}),
    });
  }

  onConversationTurn(
    callback: (data: { sessionId: string; speaker: string; text: string }) => void,
  ): () => void {
    return this.on('conversation:turn', callback);
  }

  onError(callback: (data: { code: string; message: string }) => void): () => void {
    return this.on('error', callback);
  }

  private on<T>(event: string, callback: (data: T) => void): () => void {
    const wrapped = callback as (...args: unknown[]) => void;
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(wrapped);
    this.socket?.on(event, wrapped);

    return () => {
      this.listeners.get(event)?.delete(wrapped);
      this.socket?.off(event, wrapped);
    };
  }
}

export const socketService = new SocketService();
