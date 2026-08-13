import { SessionGateway } from './session.gateway';
import type { Server, Socket } from 'socket.io';
import type { PrismaService } from '../../prisma/prisma.service';
import type { TranscriptionService } from '../transcription/transcription.service';
import type { MetricsService } from '../opentelemetry/metrics.service';
import type { JwtService } from '@nestjs/jwt';

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
    disconnect: jest.fn(),
    data: {} as {
      user?: { id: string; email: string; role: string; clinicId?: string };
    },
    handshake: {
      auth: {} as Record<string, unknown>,
      headers: {} as Record<string, string | string[] | undefined>,
    },
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  };
}

// ─── Tests ─────────────────────────────────────────────────────

describe('SessionGateway — WebSocket JWT authentication (8.1.3)', () => {
  let gateway: SessionGateway;
  let server: ReturnType<typeof makeMockServer>;
  let client: ReturnType<typeof makeMockClient>;
  const mockJwt = { verifyAsync: jest.fn() };

  const validPayload = {
    sub: 'user-1',
    email: 'doctor@clinic.test',
    role: 'DOCTOR',
    clinicId: 'clinic-1',
    type: 'access',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockJwt.verifyAsync.mockResolvedValue(validPayload);
    mockPrisma.sessionTranscript.create.mockResolvedValue({});

    server = makeMockServer(2);
    client = makeMockClient();

    gateway = new SessionGateway(
      mockPrisma as unknown as PrismaService,
      mockTranscription as unknown as TranscriptionService,
      mockMetrics as unknown as MetricsService,
      mockJwt as unknown as JwtService,
    );
    gateway.server = server as unknown as Server;
  });

  describe('handleConnection', () => {
    it('should disconnect a client with no token and emit auth:error (AUTH_REQUIRED)', async () => {
      client.handshake.auth = {};
      client.handshake.headers = {};

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.emit).toHaveBeenCalledWith(
        'auth:error',
        expect.objectContaining({ code: 'AUTH_REQUIRED' }),
      );
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(mockJwt.verifyAsync).not.toHaveBeenCalled();
    });

    it('should disconnect a client with an invalid/expired token (AUTH_INVALID)', async () => {
      client.handshake.auth = { token: 'expired-token' };
      mockJwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await gateway.handleConnection(client as unknown as Socket);

      expect(mockJwt.verifyAsync).toHaveBeenCalledWith('expired-token');
      expect(client.emit).toHaveBeenCalledWith(
        'auth:error',
        expect.objectContaining({ code: 'AUTH_INVALID' }),
      );
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.data.user).toBeUndefined();
    });

    it('should reject refresh tokens (type !== access)', async () => {
      client.handshake.auth = { token: 'refresh-token' };
      mockJwt.verifyAsync.mockResolvedValue({ ...validPayload, type: 'refresh' });

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.emit).toHaveBeenCalledWith(
        'auth:error',
        expect.objectContaining({ code: 'AUTH_INVALID' }),
      );
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should accept a valid token from auth.token and attach the user', async () => {
      client.handshake.auth = { token: 'valid-jwt' };

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data.user).toEqual({
        id: 'user-1',
        email: 'doctor@clinic.test',
        role: 'DOCTOR',
        clinicId: 'clinic-1',
      });
      expect(client.emit).toHaveBeenCalledWith('connected', { clientId: 'client-1' });
      expect(mockMetrics.setActiveSessions).toHaveBeenCalledWith(2);
    });

    it('should accept a token from the Authorization: Bearer header', async () => {
      client.handshake.auth = {};
      client.handshake.headers = { authorization: 'Bearer header-token-123' };

      await gateway.handleConnection(client as unknown as Socket);

      expect(mockJwt.verifyAsync).toHaveBeenCalledWith('header-token-123');
      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data.user?.email).toBe('doctor@clinic.test');
    });
  });

  describe('handleJoinSession', () => {
    it('should refuse to join a session room when unauthenticated', () => {
      client.data = {}; // no user attached (auth rejected earlier)

      gateway.handleJoinSession(client as unknown as Socket, 's1');

      expect(client.join).not.toHaveBeenCalled();
      expect(client.emit).toHaveBeenCalledWith(
        'auth:error',
        expect.objectContaining({ code: 'AUTH_REQUIRED' }),
      );
    });

    it('should allow an authenticated client to join a session room', () => {
      client.data.user = {
        id: validPayload.sub,
        email: validPayload.email,
        role: validPayload.role,
        clinicId: validPayload.clinicId,
      };

      gateway.handleJoinSession(client as unknown as Socket, 's1');

      expect(client.join).toHaveBeenCalledWith('session:s1');
      expect(client.emit).not.toHaveBeenCalledWith('auth:error', expect.anything());
    });
  });
});
