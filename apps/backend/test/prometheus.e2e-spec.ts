/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks */

import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenTelemetryModule } from '../src/modules/opentelemetry/opentelemetry.module';
import { MonitoringModule } from '../src/modules/monitoring/monitoring.module';
import { MetricsService } from '../src/modules/opentelemetry/metrics.service';

// NOTE: The real @Public() decorator is intentionally NOT mocked here.
// /metrics relies on it being honored (skip JWT auth) so the scrape
// endpoint is reachable without a token.

type Role = 'RECEPTIONIST' | 'DOCTOR' | 'ADMIN' | 'SYSTEM';

describe('Prometheus + Monitoring (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let metrics: MetricsService;
  const userId = '550e8400-e29b-41d4-a716-446655440000';

  async function signToken(role: Role): Promise<string> {
    return jwtService.signAsync({
      sub: userId,
      email: `user@jeevandata.com`,
      role,
    });
  }

  beforeAll(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              jwt: { secret: 'test-secret', expiration: '24h' },
            }),
          ],
        }),
        AuthModule,
        OpenTelemetryModule,
        MonitoringModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        intakeSession: { findMany: jest.fn().mockResolvedValue([]) },
      } as any)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = app.get(JwtService);
    metrics = app.get(MetricsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Isolate metric state between tests — the MetricsService is a singleton
    // shared across the module, so counters/windows accumulate otherwise.
    metrics.reset();
  });

  // ─── GET /metrics ─────────────────────────────────────────────

  describe('GET /metrics', () => {
    it('returns raw Prometheus exposition text without auth', async () => {
      const res = await request(app.getHttpServer()).get('/metrics').expect(200);

      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('jeevandata_http_requests_total');
      expect(res.text).toContain('jeevandata_http_request_duration_seconds');
      expect(res.text).toContain('jeevandata_qdrant_latency_seconds');
      expect(res.text).toContain('jeevandata_active_sessions');
    });

    it('reflects recorded request metrics in the scrape output', async () => {
      metrics.recordHttpRequest('GET', '/health', 200, 25);
      metrics.recordQdrantLatency('search', 120);

      const res = await request(app.getHttpServer()).get('/metrics').expect(200);
      expect(res.text).toContain('route="/health"');
      expect(res.text).toContain('operation="search"');
    });

    it('is not rate limited (unthrottled)', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer()).get('/metrics');
        expect(res.status).toBe(200);
      }
    });
  });

  // ─── GET /monitoring/latency ──────────────────────────────────

  describe('GET /monitoring/latency', () => {
    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/monitoring/latency').expect(401);
    });

    it('returns 403 for a DOCTOR', async () => {
      const token = await signToken('DOCTOR');
      await request(app.getHttpServer())
        .get('/monitoring/latency')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('returns latency percentiles for an ADMIN', async () => {
      metrics.recordHttpRequest('GET', '/health', 200, 30);
      const token = await signToken('ADMIN');

      const res = await request(app.getHttpServer())
        .get('/monitoring/latency')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.http).toMatchObject({ count: 1, p50: 30 });
      expect(res.body).toHaveProperty('qdrant');
    });

    it('returns latency percentiles for SYSTEM', async () => {
      const token = await signToken('SYSTEM');
      await request(app.getHttpServer())
        .get('/monitoring/latency')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  // ─── GET /monitoring/alerts ───────────────────────────────────

  describe('GET /monitoring/alerts', () => {
    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/monitoring/alerts').expect(401);
    });

    it('returns 403 for a RECEPTIONIST', async () => {
      const token = await signToken('RECEPTIONIST');
      await request(app.getHttpServer())
        .get('/monitoring/alerts')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('returns all three alert keys for an ADMIN', async () => {
      const token = await signToken('ADMIN');
      const res = await request(app.getHttpServer())
        .get('/monitoring/alerts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.map((a: { key: string }) => a.key)).toEqual([
        'http_error_rate',
        'face_match_latency',
        'session_timeout_rate',
      ]);
      // Healthy system → all ok
      expect(res.body.every((a: { severity: string }) => a.severity === 'ok')).toBe(true);
    });
  });
});
