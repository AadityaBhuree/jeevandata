import { SessionTimeoutWorker } from './session-timeout.worker';
import type { Job, Queue } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SessionService } from './session.service';

// ─── Mocks ─────────────────────────────────────────────────────

const mockPrisma = {
  intakeSession: {
    findMany: jest.fn(),
  },
};

const mockSessionService = {
  updateStatus: jest.fn(),
};

const mockConfig: Record<string, unknown> = {
  'session.inactivityTimeoutMs': 600000,
};

const mockQueue = {
  removeRepeatable: jest.fn(),
  add: jest.fn(),
};

describe('SessionTimeoutWorker', () => {
  let worker: SessionTimeoutWorker;

  const staleSession = (
    id: string,
    status = 'INITIATED',
    updatedAt = new Date(Date.now() - 700000),
  ) => ({ id, status, updatedAt });

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueue.removeRepeatable.mockResolvedValue(undefined);
    mockQueue.add.mockResolvedValue({ id: 'job1' });
    mockSessionService.updateStatus.mockResolvedValue(undefined);

    worker = new SessionTimeoutWorker(
      mockPrisma as unknown as PrismaService,
      mockSessionService as unknown as SessionService,
      {
        get: jest.fn((key: string, fallback?: unknown) => mockConfig[key] ?? fallback),
      } as unknown as ConfigService,
      mockQueue as unknown as Queue,
    );
  });

  // ─── Sweep: transitions ──────────────────────────────────────

  describe('process — timeout sweep', () => {
    it('should transition every stale session to TIMED_OUT', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([
        staleSession('550e8400-0000-4000-8000-000000000001'),
        staleSession('550e8400-0000-4000-8000-000000000002', 'INTAKE_IN_PROGRESS'),
        staleSession('550e8400-0000-4000-8000-000000000003', 'FACE_MATCHED'),
      ]);

      await worker.process({ id: 'sweep-1' } as unknown as Job<void, void, string>);

      expect(mockSessionService.updateStatus).toHaveBeenCalledTimes(3);
      expect(mockSessionService.updateStatus).toHaveBeenCalledWith(
        '550e8400-0000-4000-8000-000000000001',
        'TIMED_OUT',
      );
      expect(mockSessionService.updateStatus).toHaveBeenCalledWith(
        '550e8400-0000-4000-8000-000000000002',
        'TIMED_OUT',
      );
      expect(mockSessionService.updateStatus).toHaveBeenCalledWith(
        '550e8400-0000-4000-8000-000000000003',
        'TIMED_OUT',
      );
    });

    it('should query only non-terminal sessions older than the cutoff', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([]);

      await worker.process({ id: 'sweep-1' } as unknown as Job<void, void, string>);

      expect(mockPrisma.intakeSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { notIn: ['COMPLETED', 'FAILED', 'TIMED_OUT'] },
            updatedAt: { lt: expect.any(Date) },
          }),
        }),
      );
    });

    it('should do nothing when no stale sessions exist', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([]);

      await worker.process({ id: 'sweep-1' } as unknown as Job<void, void, string>);

      expect(mockSessionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should keep timing out remaining sessions when one transition fails', async () => {
      mockPrisma.intakeSession.findMany.mockResolvedValue([
        staleSession('550e8400-0000-4000-8000-000000000001'),
        staleSession('550e8400-0000-4000-8000-000000000002'),
      ]);
      mockSessionService.updateStatus
        .mockRejectedValueOnce(new Error('Invalid state transition: COMPLETED → TIMED_OUT'))
        .mockResolvedValueOnce(undefined);

      await expect(
        worker.process({ id: 'sweep-1' } as unknown as Job<void, void, string>),
      ).resolves.not.toThrow();

      expect(mockSessionService.updateStatus).toHaveBeenCalledTimes(2);
      expect(mockSessionService.updateStatus).toHaveBeenLastCalledWith(
        '550e8400-0000-4000-8000-000000000002',
        'TIMED_OUT',
      );
    });

    it('should swallow and log a database error without rethrowing', async () => {
      mockPrisma.intakeSession.findMany.mockRejectedValue(new Error('connection refused'));

      await expect(
        worker.process({ id: 'sweep-1' } as unknown as Job<void, void, string>),
      ).resolves.not.toThrow();

      expect(mockSessionService.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ─── Queue scheduling ────────────────────────────────────────

  describe('onModuleInit — scheduling', () => {
    it('should remove stale repeatable jobs and schedule a 60s sweep', async () => {
      await worker.onModuleInit();

      expect(mockQueue.removeRepeatable).toHaveBeenCalledWith('session-timeout-sweep', {
        every: 60_000,
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        'session-timeout-sweep',
        {},
        expect.objectContaining({
          repeat: { every: 60_000 },
          removeOnComplete: true,
          removeOnFail: false,
        }),
      );
    });

    it('should not fail when no previous repeatable job exists', async () => {
      mockQueue.removeRepeatable.mockRejectedValue(new Error('repeatable job not found'));

      await expect(worker.onModuleInit()).resolves.not.toThrow();
      expect(mockQueue.add).toHaveBeenCalled();
    });
  });
});
