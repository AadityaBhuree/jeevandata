import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, Controller, Get, HttpStatus } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, SkipThrottle } from '@nestjs/throttler';
import request from 'supertest';
import { CustomThrottlerGuard } from '../src/common/guards/throttler.guard';

// ─── Test Controllers ───────────────────────────────────────────

@Controller('rate-limited')
export class RateLimitedController {
  @Get()
  get() {
    return { message: 'rate limited' };
  }
}

@Controller('rate-skipped')
@SkipThrottle()
export class RateSkippedController {
  @Get()
  get() {
    return { message: 'rate skip' };
  }
}

// ─── Tests ──────────────────────────────────────────────────────
//
// IMPORTANT: All tests within a single describe block share the app
// instance and therefore the in-memory rate counter. Sequential test
// actions are combined into single it() blocks to avoid ordering bugs.

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // Very tight limit: 2 requests per 60s sliding window
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 2 }]),
      ],
      controllers: [RateLimitedController, RateSkippedController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: CustomThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ─── @SkipThrottle() — entire controller bypasses rate limit ──

  describe('@SkipThrottle() on controller', () => {
    it('should never return 429 even after 10 rapid requests', async () => {
      // Sequential, not Promise.all: concurrent requests on a shared agent
      // trigger "read ECONNRESET" on Node 20 (CI) but pass on Node 24.
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer()).get('/rate-skipped').expect(HttpStatus.OK);
        expect(res.body).toEqual({ message: 'rate skip' });
      }
    });
  });

  // ─── Rate limiting + @SkipThrottle(): combined sequential test ─
  //
  // The in-memory rate counter is shared across ALL tests on the same
  // app instance. Both sequences (allow 2 → block 3rd + skip-throttle
  // still works) must execute in one it() block to avoid ordering bugs.

  describe('Rate limiting + @SkipThrottle()', () => {
    it('should block after 2, return JSON error, and not affect skip-throttle routes', async () => {
      // ── Phase 1: 2 OK requests ──
      await request(app.getHttpServer()).get('/rate-limited').expect(HttpStatus.OK);
      await request(app.getHttpServer()).get('/rate-limited').expect(HttpStatus.OK);

      // ── Phase 2: 3rd request = 429 ──
      const res = await request(app.getHttpServer())
        .get('/rate-limited')
        .expect(HttpStatus.TOO_MANY_REQUESTS);

      // Verify JSON error shape from CustomThrottlerGuard
      expect(res.body).toMatchObject({
        statusCode: 429,
        message: 'Too many requests. Please try again later.',
        error: 'ThrottlerException',
      });
      // Should NOT include extra fields like retryAfterMs
      expect(res.body).not.toHaveProperty('retryAfterMs');

      // ── Phase 3: @SkipThrottle() still works even while regular is blocked ──
      await request(app.getHttpServer()).get('/rate-skipped').expect(HttpStatus.OK);
    });
  });
});
