import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { HealthModule } from '../src/modules/health/health.module';
import { HealthService } from '../src/modules/health/health.service';

// Mock @Public() decorator to be a no-op in test environment
jest.mock('../src/common/decorators/public.decorator', () => ({
  Public: () => jest.fn(),
}));

// ─── Mock Services ──────────────────────────────────────────────

const mockHealthService = {
  getLiveness: jest.fn(),
  getReadiness: jest.fn(),
  getHealth: jest.fn(),
};

// ─── Test Data ──────────────────────────────────────────────────

const mockLivenessResponse = {
  status: 'alive',
  uptimeMs: 12345,
  timestamp: '2025-07-28T12:00:00.000Z',
};

const mockHealthyReadiness = {
  status: 'healthy',
  checks: {
    database: { status: 'healthy', latencyMs: 5 },
    redis: { status: 'healthy', latencyMs: 2 },
    qdrant: { status: 'healthy', latencyMs: 3 },
    whisper: { status: 'healthy', latencyMs: 4 },
  },
  timestamp: '2025-07-28T12:00:00.000Z',
};

const mockUnhealthyReadiness = {
  status: 'unhealthy',
  checks: {
    database: { status: 'unhealthy', latencyMs: 3000, error: 'Connection refused' },
    redis: { status: 'unhealthy', latencyMs: 0, error: 'Redis URL not configured' },
    qdrant: { status: 'unhealthy', latencyMs: 0, error: 'Qdrant URL not configured' },
    whisper: { status: 'unhealthy', latencyMs: 0, error: 'Whisper health check failed' },
  },
  timestamp: '2025-07-28T12:00:00.000Z',
};

const mockHealthyHealth = {
  status: 'healthy',
  uptimeMs: 12345,
  dependencies: '4/4 healthy',
  timestamp: '2025-07-28T12:00:00.000Z',
};

const mockUnhealthyHealth = {
  status: 'unhealthy',
  uptimeMs: 12345,
  dependencies: '0/4 healthy',
  timestamp: '2025-07-28T12:00:00.000Z',
};

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .overrideProvider(HealthService)
      .useValue(mockHealthService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /health/live ────────────────────────────────────────

  describe('GET /health/live', () => {
    it('should return alive status with uptime', async () => {
      mockHealthService.getLiveness.mockReturnValue(mockLivenessResponse);

      const res = await request(app.getHttpServer()).get('/health/live').expect(HttpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'alive',
        uptimeMs: expect.any(Number),
        timestamp: expect.any(String),
      });
    });

    it('should call getLiveness service method', async () => {
      mockHealthService.getLiveness.mockReturnValue(mockLivenessResponse);

      await request(app.getHttpServer()).get('/health/live');

      expect(mockHealthService.getLiveness).toHaveBeenCalledTimes(1);
    });
  });

  // ─── GET /health/ready ────────────────────────────────────────

  describe('GET /health/ready', () => {
    it('should return 200 with healthy status when all deps are up', async () => {
      mockHealthService.getReadiness.mockResolvedValue(mockHealthyReadiness);

      const res = await request(app.getHttpServer()).get('/health/ready').expect(HttpStatus.OK);

      expect(res.body.status).toBe('healthy');
      expect(res.body.checks.database).toMatchObject({ status: 'healthy' });
      expect(res.body.checks.redis).toMatchObject({ status: 'healthy' });
      expect(res.body.checks.qdrant).toMatchObject({ status: 'healthy' });
      expect(res.body.checks.whisper).toMatchObject({ status: 'healthy' });
    });

    it('should return 503 when any dependency is down', async () => {
      mockHealthService.getReadiness.mockResolvedValue(mockUnhealthyReadiness);

      const res = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      // 503 body carries the HealthCheckResult in the HttpException payload so
      // the admin UI can still render per-dependency status when degraded.
      // 503 body carries the HealthCheckResult in the HttpException payload so
      // the admin UI can still render per-dependency status when degraded.
      // (E2E module has no global filter — Nest emits the object verbatim.)
      expect(res.body.code).toBe('HEALTH_UNHEALTHY');
      expect(res.body.details.status).toBe('unhealthy');
      expect(res.body.details.checks.database).toMatchObject({
        status: 'unhealthy',
        error: 'Connection refused',
      });
    });

    it('should report all dependency statuses in response', async () => {
      mockHealthService.getReadiness.mockResolvedValue(mockHealthyReadiness);

      const res = await request(app.getHttpServer()).get('/health/ready').expect(HttpStatus.OK);

      expect(res.body.checks).toHaveProperty('database');
      expect(res.body.checks).toHaveProperty('redis');
      expect(res.body.checks).toHaveProperty('qdrant');
      expect(res.body.checks).toHaveProperty('whisper');
    });

    it('should call getReadiness service method', async () => {
      mockHealthService.getReadiness.mockResolvedValue(mockHealthyReadiness);

      await request(app.getHttpServer()).get('/health/ready');

      expect(mockHealthService.getReadiness).toHaveBeenCalledTimes(1);
    });

    it('should propagate service errors as 500', async () => {
      mockHealthService.getReadiness.mockRejectedValue(new Error('Unexpected error'));

      await request(app.getHttpServer())
        .get('/health/ready')
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  // ─── GET /health ──────────────────────────────────────────────

  describe('GET /health', () => {
    it('should return 200 with summary when all deps are healthy', async () => {
      mockHealthService.getHealth.mockResolvedValue(mockHealthyHealth);

      const res = await request(app.getHttpServer()).get('/health').expect(HttpStatus.OK);

      expect(res.body).toMatchObject({
        status: 'healthy',
        dependencies: '4/4 healthy',
      });
    });

    it('should return 503 when critical dependency is down', async () => {
      mockHealthService.getHealth.mockResolvedValue(mockUnhealthyHealth);

      const res = await request(app.getHttpServer())
        .get('/health')
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      expect(res.body.code).toBe('HEALTH_UNHEALTHY');
      expect(res.body.details.status).toBe('unhealthy');
    });

    it('should call getHealth service method', async () => {
      mockHealthService.getHealth.mockResolvedValue(mockHealthyHealth);

      await request(app.getHttpServer()).get('/health');

      expect(mockHealthService.getHealth).toHaveBeenCalledTimes(1);
    });
  });
});
