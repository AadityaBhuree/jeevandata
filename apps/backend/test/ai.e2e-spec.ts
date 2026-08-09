// ─── ioredis Mock ──────────────────────────────────────────────
// BullMQ uses ioredis internally. This mock prevents BullMQ from
// attempting a real Redis connection during E2E tests.
const mockIoRedis = {
  on: jest.fn().mockReturnThis(),
  once: jest.fn().mockReturnThis(),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue('OK'),
  duplicate: jest.fn().mockReturnThis(),
  isReady: true,
  status: 'ready',
  options: {},
  ping: jest.fn().mockResolvedValue('PONG'),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  brpoplpush: jest.fn().mockResolvedValue(null),
  lpush: jest.fn().mockResolvedValue(1),
  llen: jest.fn().mockResolvedValue(0),
  lrange: jest.fn().mockResolvedValue([]),
  lrem: jest.fn().mockResolvedValue(0),
  zadd: jest.fn().mockResolvedValue(0),
  zrange: jest.fn().mockResolvedValue([]),
  zrem: jest.fn().mockResolvedValue(0),
  multi: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
  call: jest.fn().mockResolvedValue(undefined),
  sendCommand: jest.fn().mockResolvedValue(undefined),
  waitUntilReady: jest.fn().mockResolvedValue(undefined),
};
jest.mock('ioredis', () => ({
  Redis: jest.fn(() => mockIoRedis),
  default: jest.fn(() => mockIoRedis),
}));

import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe, Logger } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../src/modules/ai/ai.module';
import { AiService } from '../src/modules/ai/ai.service';
import { SessionService } from '../src/modules/session/session.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SessionGateway } from '../src/modules/session/session.gateway';
import { SessionTimeoutWorker } from '../src/modules/session/session-timeout.worker';
import { TranscriptionService } from '../src/modules/transcription/transcription.service';

// ─── Mock Service ──────────────────────────────────────────────

const mockAiService = {
  processIntakeConversation: jest.fn(),
  generateClinicalBrief: jest.fn(),
};

// ─── Test Data ──────────────────────────────────────────────────

const validUuid = '550e8400-e29b-41d4-a716-446655440000';
const validPatientId = '660e8400-e29b-41d4-a716-446655440001';

const mockConversationResult = {
  response: 'I understand. Could you tell me more about your headache?',
  intakeComplete: false,
};

const mockBriefResult = {
  summary: 'Patient presents with headache and fever for 3 days.',
  chiefComplaint: 'Headache and fever',
  riskFlags: [],
  vitalsToCheck: ['Blood Pressure', 'Heart Rate', 'Temperature'],
  suggestedFollowups: ['Any visual disturbances?'],
  medicationsNote: 'None reported',
  icd10Hints: ['R51', 'R50.9'],
};

const validIntakeData = {
  chiefComplaint: 'Headache and fever',
  symptoms: [{ name: 'Headache', duration: '3 days', severity: 6 }],
  associated: ['Fatigue', 'Nausea'],
  medicationChanges: 'None',
  allergyUpdates: 'No known allergies',
  patientNotes: '',
};

describe('AiController (E2E)', () => {
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

  // ─── Helper: create Nest app with necessary global modules ─────
  //
  // AiModule imports SessionModule, which has providers that connect
  // to external services (Redis, BullMQ). We override ALL non-controller
  // providers that would make external connections.

  async function createApp(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        BullModule.forRoot({
          connection: {
            host: '127.0.0.1',
            port: 6379,
            retryStrategy: () => null,
            maxRetriesPerRequest: null,
          },
        }),
        AiModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({} as unknown as PrismaService)
      .overrideProvider(AiService)
      .useValue(mockAiService)
      .overrideProvider(SessionService)
      .useValue({} as unknown as SessionService)
      .overrideProvider(SessionGateway)
      .useValue({} as unknown as SessionGateway)
      .overrideProvider(SessionTimeoutWorker)
      .useValue({} as unknown as SessionTimeoutWorker)
      .overrideProvider(TranscriptionService)
      .useValue({} as unknown as TranscriptionService)
      .compile();

    const app = moduleFixture.createNestApplication();

    // Suppress NestJS error logs during tests
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

  // ─── POST /ai/intake-agent ─────────────────────────────────────

  describe('POST /ai/intake-agent', () => {
    const validPayload = {
      sessionId: validUuid,
      patientContext: '35-year-old female with history of migraines',
      conversationHistory: [
        { role: 'assistant' as const, content: 'Hello, how can I help you today?' },
        { role: 'user' as const, content: 'I have a bad headache' },
      ],
      currentInput: 'It started three days ago',
    };

    it('should process an intake conversation turn successfully', async () => {
      mockAiService.processIntakeConversation.mockResolvedValue(mockConversationResult);

      const res = await request(app.getHttpServer())
        .post('/ai/intake-agent')
        .send(validPayload)
        .expect(200);

      expect(res.body).toHaveProperty('response');
      expect(res.body).toHaveProperty('intakeComplete', false);
      expect(res.body.response).toContain('headache');
      expect(mockAiService.processIntakeConversation).toHaveBeenCalledTimes(1);
    });

    it('should return intakeComplete true when conversation is complete', async () => {
      mockAiService.processIntakeConversation.mockResolvedValue({
        response: 'Thank you. I have all the information I need.',
        intakeComplete: true,
      });

      const res = await request(app.getHttpServer())
        .post('/ai/intake-agent')
        .send(validPayload)
        .expect(200);

      expect(res.body).toHaveProperty('intakeComplete', true);
    });

    it('should reject missing sessionId', async () => {
      const { sessionId: _, ...rest } = validPayload;
      await request(app.getHttpServer()).post('/ai/intake-agent').send(rest).expect(400);
    });

    it('should reject missing currentInput', async () => {
      const { currentInput: _, ...rest } = validPayload;
      await request(app.getHttpServer()).post('/ai/intake-agent').send(rest).expect(400);
    });

    it('should reject empty currentInput', async () => {
      await request(app.getHttpServer())
        .post('/ai/intake-agent')
        .send({ ...validPayload, currentInput: '' })
        .expect(400);
    });

    it('should reject missing patientContext', async () => {
      const { patientContext: _, ...rest } = validPayload;
      await request(app.getHttpServer()).post('/ai/intake-agent').send(rest).expect(400);
    });

    it('should reject invalid UUID for sessionId', async () => {
      await request(app.getHttpServer())
        .post('/ai/intake-agent')
        .send({ ...validPayload, sessionId: 'not-a-uuid' })
        .expect(400);
    });

    it('should reject invalid role in conversationHistory', async () => {
      await request(app.getHttpServer())
        .post('/ai/intake-agent')
        .send({
          ...validPayload,
          conversationHistory: [{ role: 'invalid-role', content: 'test' }],
        })
        .expect(400);
    });

    it('should propagate service errors as 500', async () => {
      mockAiService.processIntakeConversation.mockRejectedValue(
        new Error('Gemini API unavailable'),
      );

      await request(app.getHttpServer()).post('/ai/intake-agent').send(validPayload).expect(500);
    });
  });

  // ─── POST /ai/brief ──────────────────────────────────────────

  describe('POST /ai/brief', () => {
    const validPayload = {
      sessionId: validUuid,
      patientId: validPatientId,
      intakeData: validIntakeData,
      transcript: `patient: I have a headache\nai: How long?\npatient: Three days`,
      patientHistory: '35-year-old female, history of migraines',
    };

    it('should generate a clinical brief successfully', async () => {
      mockAiService.generateClinicalBrief.mockResolvedValue(mockBriefResult);

      const res = await request(app.getHttpServer())
        .post('/ai/brief')
        .send(validPayload)
        .expect(200);

      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('chiefComplaint', 'Headache and fever');
      expect(res.body).toHaveProperty('riskFlags');
      expect(res.body).toHaveProperty('vitalsToCheck');
      expect(res.body).toHaveProperty('icd10Hints');
      expect(Array.isArray(res.body.icd10Hints)).toBe(true);
      expect(res.body.icd10Hints).toContain('R51');
    });

    it('should return brief with empty risk flags when no risks', async () => {
      mockAiService.generateClinicalBrief.mockResolvedValue(mockBriefResult);

      const res = await request(app.getHttpServer())
        .post('/ai/brief')
        .send(validPayload)
        .expect(200);

      expect(res.body.riskFlags).toEqual([]);
    });

    it('should return brief with risk flags when present', async () => {
      mockAiService.generateClinicalBrief.mockResolvedValue({
        ...mockBriefResult,
        riskFlags: ['Chest pain reported', 'Shortness of breath'],
      });

      const res = await request(app.getHttpServer())
        .post('/ai/brief')
        .send(validPayload)
        .expect(200);

      expect(res.body.riskFlags).toHaveLength(2);
      expect(res.body.riskFlags[0]).toBe('Chest pain reported');
    });

    it('should reject missing sessionId', async () => {
      const { sessionId: _, ...rest } = validPayload;
      await request(app.getHttpServer()).post('/ai/brief').send(rest).expect(400);
    });

    it('should reject missing patientId', async () => {
      const { patientId: _, ...rest } = validPayload;
      await request(app.getHttpServer()).post('/ai/brief').send(rest).expect(400);
    });

    it('should reject missing intakeData', async () => {
      const { intakeData: _, ...rest } = validPayload;
      await request(app.getHttpServer()).post('/ai/brief').send(rest).expect(400);
    });

    it('should reject missing transcript', async () => {
      const { transcript: _, ...rest } = validPayload;
      await request(app.getHttpServer()).post('/ai/brief').send(rest).expect(400);
    });

    it('should reject invalid UUID for sessionId', async () => {
      await request(app.getHttpServer())
        .post('/ai/brief')
        .send({ ...validPayload, sessionId: 'bad-uuid' })
        .expect(400);
    });

    it('should reject invalid UUID for patientId', async () => {
      await request(app.getHttpServer())
        .post('/ai/brief')
        .send({ ...validPayload, patientId: 'also-bad' })
        .expect(400);
    });

    it('should reject non-string transcript', async () => {
      await request(app.getHttpServer())
        .post('/ai/brief')
        .send({ ...validPayload, transcript: 12345 })
        .expect(400);
    });

    it('should reject transcript exceeding max length', async () => {
      await request(app.getHttpServer())
        .post('/ai/brief')
        .send({ ...validPayload, transcript: 'A'.repeat(100001) })
        .expect(400);
    });

    it('should reject missing patientHistory', async () => {
      const { patientHistory: _, ...rest } = validPayload;
      await request(app.getHttpServer()).post('/ai/brief').send(rest).expect(400);
    });

    it('should propagate service errors as 500', async () => {
      mockAiService.generateClinicalBrief.mockRejectedValue(new Error('Brief generation failed'));

      await request(app.getHttpServer()).post('/ai/brief').send(validPayload).expect(500);
    });
  });
});
