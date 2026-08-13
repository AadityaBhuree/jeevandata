import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe, NotFoundException, Logger } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { DashboardModule } from '../src/modules/dashboard/dashboard.module';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { PrismaService } from '../src/prisma/prisma.service';

// ─── Mock Service ──────────────────────────────────────────────

const mockDashboardService = {
  getLatestBrief: jest.fn(),
  getActiveSessions: jest.fn(),
  getRecentBriefs: jest.fn(),
  markBriefReviewed: jest.fn(),
  getPatientHistory: jest.fn(),
};

// ─── Test Data ──────────────────────────────────────────────────

const validUuid = '550e8400-e29b-41d4-a716-446655440000';
const validPatientId = '660e8400-e29b-41d4-a716-446655440001';
const validBriefId = '770e8400-e29b-41d4-a716-446655440002';

const mockBrief = {
  id: 'brief-1',
  sessionId: validUuid,
  patientId: validPatientId,
  brief: {
    summary: 'Patient presents with headache.',
    chiefComplaint: 'Headache',
    riskFlags: [],
    vitalsToCheck: ['BP', 'HR'],
    suggestedFollowups: [],
    medicationsNote: 'None',
    icd10Hints: ['R51'],
  },
  intakeData: { chiefComplaint: 'Headache', symptoms: [], associated: [] },
  session: { id: validUuid, startedAt: '2025-01-15T10:30:00Z', status: 'BRIEF_GENERATED' },
  generatedAt: '2025-01-15T10:35:00Z',
};

const mockSession = {
  id: validUuid,
  patientId: validPatientId,
  status: 'INTAKE_IN_PROGRESS',
  startedAt: '2025-01-15T10:30:00Z',
  patient: { id: validPatientId, name: 'Priya Sharma', dob: '1990-01-15' },
};

const mockReviewResponse = { success: true, message: 'Brief marked as reviewed' };

describe('DashboardController (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    jest.clearAllMocks();
    app = await createApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Helper: create Nest app ───────────────────────────────────
  //
  // DashboardModule is self-contained (no external service deps).
  // Only ConfigModule needed for @Public() decorator.

  async function createApp(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), DashboardModule],
    })
      .overrideProvider(PrismaService)
      .useValue({} as unknown as PrismaService)
      .overrideProvider(DashboardService)
      .useValue(mockDashboardService)
      .compile();

    const app = moduleFixture.createNestApplication();

    app.useLogger(new Logger('E2E', { timestamp: false }));

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
    return app;
  }

  // ─── GET /dashboard/patient/:patientId/latest-brief ────────────

  describe('GET /dashboard/patient/:patientId/latest-brief', () => {
    it('should return the latest brief for a patient', async () => {
      mockDashboardService.getLatestBrief.mockResolvedValue(mockBrief);

      const res = await request(app.getHttpServer())
        .get(`/dashboard/patient/${validPatientId}/latest-brief`)
        .expect(200);

      expect(res.body).toHaveProperty('id', 'brief-1');
      expect(res.body).toHaveProperty('patientId', validPatientId);
      expect(res.body.brief).toHaveProperty('chiefComplaint', 'Headache');
      expect(res.body).toHaveProperty('session');
      expect(res.body.session).toHaveProperty('status', 'BRIEF_GENERATED');
    });

    it('should return 404 when no brief exists for patient', async () => {
      mockDashboardService.getLatestBrief.mockRejectedValue(
        new NotFoundException(`No intake records found for patient ${validPatientId}`),
      );

      await request(app.getHttpServer())
        .get(`/dashboard/patient/${validPatientId}/latest-brief`)
        .expect(404);
    });

    it('should reject invalid patientId UUID', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/patient/invalid-uuid/latest-brief')
        .expect(400);
    });

    it('should propagate service errors as 500', async () => {
      mockDashboardService.getLatestBrief.mockRejectedValue(new Error('Database unavailable'));

      await request(app.getHttpServer())
        .get(`/dashboard/patient/${validPatientId}/latest-brief`)
        .expect(500);
    });
  });

  // ─── GET /dashboard/active-sessions ────────────────────────────

  describe('GET /dashboard/active-sessions', () => {
    const paginatedResponse = {
      data: [mockSession],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };

    it('should return active sessions with pagination', async () => {
      mockDashboardService.getActiveSessions.mockResolvedValue(paginatedResponse);

      const res = await request(app.getHttpServer()).get('/dashboard/active-sessions').expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toHaveProperty('page', 1);
      expect(res.body.pagination).toHaveProperty('total');
    });

    it('should accept custom page and limit query params', async () => {
      mockDashboardService.getActiveSessions.mockResolvedValue({
        data: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/active-sessions?page=2&limit=10')
        .expect(200);

      expect(res.body.pagination).toHaveProperty('page', 2);
      expect(res.body.pagination).toHaveProperty('limit', 10);
      expect(mockDashboardService.getActiveSessions).toHaveBeenCalledWith(2, 10, undefined);
    });

    it('should reject negative page numbers', async () => {
      await request(app.getHttpServer()).get('/dashboard/active-sessions?page=-1').expect(400);
    });

    it('should reject limit exceeding 100', async () => {
      await request(app.getHttpServer()).get('/dashboard/active-sessions?limit=200').expect(400);
    });

    it('should propagate service errors as 500', async () => {
      mockDashboardService.getActiveSessions.mockRejectedValue(new Error('Query failed'));

      await request(app.getHttpServer()).get('/dashboard/active-sessions').expect(500);
    });
  });

  // ─── GET /dashboard/recent-briefs ──────────────────────────────

  describe('GET /dashboard/recent-briefs', () => {
    const paginatedResponse = {
      data: [mockBrief],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };

    it('should return recent briefs with pagination', async () => {
      mockDashboardService.getRecentBriefs.mockResolvedValue(paginatedResponse);

      const res = await request(app.getHttpServer()).get('/dashboard/recent-briefs').expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination).toHaveProperty('page', 1);
    });

    it('should accept pagination params', async () => {
      mockDashboardService.getRecentBriefs.mockResolvedValue({
        data: [],
        pagination: { page: 3, limit: 5, total: 0, totalPages: 0 },
      });

      await request(app.getHttpServer()).get('/dashboard/recent-briefs?page=3&limit=5').expect(200);

      expect(mockDashboardService.getRecentBriefs).toHaveBeenCalledWith(3, 5, undefined);
    });

    it('should reject non-numeric page param', async () => {
      await request(app.getHttpServer()).get('/dashboard/recent-briefs?page=abc').expect(400);
    });

    it('should propagate service errors as 500', async () => {
      mockDashboardService.getRecentBriefs.mockRejectedValue(new Error('Query failed'));

      await request(app.getHttpServer()).get('/dashboard/recent-briefs').expect(500);
    });
  });

  // ─── PATCH /brief/:id/review ───────────────────────────────────

  describe('PATCH /brief/:id/review', () => {
    it('should mark a brief as reviewed', async () => {
      mockDashboardService.markBriefReviewed.mockResolvedValue(mockReviewResponse);

      const res = await request(app.getHttpServer())
        .patch(`/brief/${validBriefId}/review`)
        .expect(200);

      expect(res.body).toEqual(mockReviewResponse);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'Brief marked as reviewed');
    });

    it('should return 404 when brief does not exist', async () => {
      const unusedUuid = '00000000-0000-0000-0000-000000000000';
      mockDashboardService.markBriefReviewed.mockRejectedValue(
        new NotFoundException(`Brief ${unusedUuid} not found`),
      );

      await request(app.getHttpServer()).patch(`/brief/${unusedUuid}/review`).expect(404);
    });

    it('should reject invalid brief UUID', async () => {
      await request(app.getHttpServer()).patch('/brief/not-a-uuid/review').expect(400);
    });

    it('should propagate service errors as 500', async () => {
      mockDashboardService.markBriefReviewed.mockRejectedValue(new Error('Update failed'));

      await request(app.getHttpServer()).patch(`/brief/${validBriefId}/review`).expect(500);
    });
  });

  // ─── GET /dashboard/patient/:patientId/history ─────────────────

  describe('GET /dashboard/patient/:patientId/history', () => {
    const paginatedResponse = {
      data: [mockBrief],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };

    it('should return patient history with pagination', async () => {
      mockDashboardService.getPatientHistory.mockResolvedValue(paginatedResponse);

      const res = await request(app.getHttpServer())
        .get(`/dashboard/patient/${validPatientId}/history`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toHaveProperty('page', 1);
    });

    it('should accept custom page and limit', async () => {
      mockDashboardService.getPatientHistory.mockResolvedValue({
        data: [],
        pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
      });

      await request(app.getHttpServer())
        .get(`/dashboard/patient/${validPatientId}/history?page=2&limit=5`)
        .expect(200);

      expect(mockDashboardService.getPatientHistory).toHaveBeenCalledWith(
        validPatientId,
        2,
        5,
        undefined,
      );
    });

    it('should reject invalid patientId UUID', async () => {
      await request(app.getHttpServer()).get('/dashboard/patient/bad-uuid/history').expect(400);
    });

    it('should reject limit exceeding 100', async () => {
      await request(app.getHttpServer())
        .get(`/dashboard/patient/${validPatientId}/history?limit=500`)
        .expect(400);
    });

    it('should propagate service errors as 500', async () => {
      mockDashboardService.getPatientHistory.mockRejectedValue(new Error('Query failed'));

      await request(app.getHttpServer())
        .get(`/dashboard/patient/${validPatientId}/history`)
        .expect(500);
    });
  });
});
