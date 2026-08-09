import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, Controller, Get, HttpStatus } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';

import { HealthModule } from '../src/modules/health/health.module';
import { HealthService } from '../src/modules/health/health.service';
import { CustomThrottlerGuard } from '../src/common/guards/throttler.guard';

// ─── Mock @Public() decorator — no-op in test environment ───────

jest.mock('../src/common/decorators/public.decorator', () => ({
  Public: () => jest.fn(),
}));

// ─── Test Controller (rate-limited control) ─────────────────────
//
// This controller has NO @SkipThrottle() decorator, so it should be
// subject to the 2-request-per-60s limit configured below.

@Controller('test-limited')
export class TestLimitedController {
  @Get()
  get() {
    return { message: 'limited' };
  }
}

// ─── Mock HealthService — no real DB/Redis/Qdrant needed ───────

const mockHealthService = {
  getLiveness: jest.fn(),
  getReadiness: jest.fn(),
  getHealth: jest.fn(),
};

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

const mockHealthyHealth = {
  status: 'healthy',
  uptimeMs: 12345,
  dependencies: '4/4 healthy',
  timestamp: '2025-07-28T12:00:00.000Z',
};

// ─── Test Suite ─────────────────────────────────────────────────

describe('HealthController Rate Limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // Very tight limit: 2 requests per 60s sliding window
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 2 }]),
        HealthModule,
      ],
      controllers: [TestLimitedController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: CustomThrottlerGuard,
        },
      ],
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
    mockHealthService.getLiveness.mockReturnValue(mockLivenessResponse);
    mockHealthService.getReadiness.mockResolvedValue(mockHealthyReadiness);
    mockHealthService.getHealth.mockResolvedValue(mockHealthyHealth);
  });

  // ─── @SkipThrottle() on all health endpoints ──────────────────

  describe('@SkipThrottle() on HealthController', () => {
    it('should never return 429 on /health/live after 10 rapid requests', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer()).get('/health/live').expect(HttpStatus.OK);
        expect(res.body).toHaveProperty('status', 'alive');
      }
      // Verify the service was actually called 10 times
      expect(mockHealthService.getLiveness).toHaveBeenCalledTimes(10);
    });

    it('should never return 429 on /health/ready after 10 rapid requests', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer()).get('/health/ready').expect(HttpStatus.OK);
        expect(res.body).toHaveProperty('status', 'healthy');
      }
      expect(mockHealthService.getReadiness).toHaveBeenCalledTimes(10);
    });

    it('should never return 429 on /health after 10 rapid requests', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer()).get('/health').expect(HttpStatus.OK);
        expect(res.body).toHaveProperty('status', 'healthy');
      }
      expect(mockHealthService.getHealth).toHaveBeenCalledTimes(10);
    });
  });

  // ─── Rate limiting STILL works on non-health routes ───────────

  describe('Rate limiting still applies to non-health routes', () => {
    it('should block /test-limited after 2 requests while health endpoints remain accessible', async () => {
      // ── Phase 1: Exhaust the 2-request limit on the control endpoint ──
      await request(app.getHttpServer()).get('/test-limited').expect(HttpStatus.OK);
      await request(app.getHttpServer()).get('/test-limited').expect(HttpStatus.OK);

      // ── Phase 2: 3rd request to test-limited = 429 ──
      const res = await request(app.getHttpServer())
        .get('/test-limited')
        .expect(HttpStatus.TOO_MANY_REQUESTS);

      expect(res.body).toMatchObject({
        statusCode: 429,
        message: 'Too many requests. Please try again later.',
        error: 'ThrottlerException',
      });

      // ── Phase 3: Health endpoints are NOT affected ──
      await request(app.getHttpServer()).get('/health/live').expect(HttpStatus.OK);
      await request(app.getHttpServer()).get('/health/ready').expect(HttpStatus.OK);
      await request(app.getHttpServer()).get('/health').expect(HttpStatus.OK);
    });
  });
});
