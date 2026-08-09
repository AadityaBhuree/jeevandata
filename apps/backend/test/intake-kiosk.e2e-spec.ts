/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks */

/**
 * Kiosk completion regression E2E — REAL IntakeService + REAL SessionService FSM.
 *
 * Guards the two production fixes made after the clinic-journey verification:
 *  1. FSM fast-forward — a kiosk session created via POST /intake/session stays
 *     INITIATED (the UI never reports intermediate transitions to the backend),
 *     so completion must walk INITIATED -> ... -> TRANSCRIBING -> BRIEF_GENERATED
 *     instead of 400ing with "Invalid state transition: INITIATED -> TRANSCRIBING".
 *  2. patientId resolution — IntakeRecord.patientId is a required UUID FK and
 *     kiosk sessions are created before face match, so the complete payload must
 *     carry the matched patientId, persist it onto the session, and use it for
 *     the record. A missing patientId must 400 (not 500 on an empty UUID).
 *
 * Unlike intake.e2e-spec.ts (which mocks IntakeService), this spec keeps the
 * real controller + real IntakeService + real SessionService and only fakes
 * Prisma/Redis/AI — so the actual fast-forward walk and transition table run.
 */

// Redis mock (SessionService constructs `new Redis(url)` at bootstrap).
const mockIoRedis = {
  on: jest.fn().mockReturnThis(),
  once: jest.fn().mockReturnThis(),
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue('OK'),
  duplicate: jest.fn().mockReturnThis(),
  ping: jest.fn().mockResolvedValue('PONG'),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(-1),
};

jest.mock('ioredis', () => ({
  Redis: jest.fn(() => mockIoRedis),
}));

import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { IntakeController } from '../src/modules/intake/intake.controller';
import { IntakeService } from '../src/modules/intake/intake.service';
import { SessionService } from '../src/modules/session/session.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { BriefGeneratorService } from '../src/modules/ai/brief-generator.service';
import { AuditService } from '../src/modules/audit/audit.service';

// Stateful in-memory Prisma fake — mirrors the real DB semantics the
// regression depends on (session status mutations persist, records append).
const sessions = new Map<string, any>();
const records: any[] = [];
let sessionCounter = 0;

const fakePrisma = {
  intakeSession: {
    create: jest.fn(async ({ data }: any) => {
      sessionCounter += 1;
      const row = {
        id: `550e8400-e29b-41d4-a716-44665544${String(sessionCounter).padStart(4, '0')}`,
        status: 'INITIATED',
        startedAt: new Date(),
        endedAt: null,
        ...data,
      };
      sessions.set(row.id, row);
      return row;
    }),
    findUnique: jest.fn(async ({ where }: any) => sessions.get(where.id) ?? null),
    update: jest.fn(async ({ where, data }: any) => {
      const row = { ...(sessions.get(where.id) ?? {}), ...data };
      sessions.set(where.id, row);
      return row;
    }),
  },
  intakeRecord: {
    create: jest.fn(async ({ data }: any) => {
      const rec = { id: `record-${records.length + 1}`, ...data, generatedAt: new Date() };
      records.push(rec);
      return rec;
    }),
    findFirst: jest.fn(async () => records[records.length - 1] ?? null),
  },
} as any;

// Dependency mocks (AI brief + audit are out of scope for this regression).
const fixedBrief = {
  summary: 'Patient presents with fever and headache for 2 days.',
  chiefComplaint: 'Fever and headache',
  riskFlags: [],
  vitalsToCheck: ['Blood Pressure', 'Heart Rate', 'Temperature'],
  suggestedFollowups: ['Any vomiting?'],
  medicationsNote: 'Took paracetamol',
  icd10Hints: ['R50.9', 'R51'],
};

const mockBriefGen = { generate: jest.fn().mockResolvedValue(fixedBrief) };
const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockConfig = {
  get: jest.fn((key: string) => (key === 'redis.url' ? 'redis://127.0.0.1:6379' : undefined)),
};
const mockMetrics = {
  incrementSessionTimeouts: jest.fn(),
  incrementSessionsCompleted: jest.fn(),
};

const PATIENT_ID = '660e8400-e29b-41d4-a716-446655440001';
const validIntakeData = {
  patientId: PATIENT_ID,
  chiefComplaint: 'Fever and headache',
  symptoms: [{ name: 'fever', duration: '2 days', severity: 6 }],
  associated: ['body ache'],
  medicationChanges: 'Took paracetamol yesterday',
  allergyUpdates: 'None known',
  patientNotes: 'Feels very weak',
};

describe('Kiosk intake completion (E2E, real service + FSM)', () => {
  let app: INestApplication;
  let httpServer: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [IntakeController],
      providers: [
        IntakeService,
        { provide: PrismaService, useValue: fakePrisma },
        {
          provide: SessionService,
          useFactory: () => new SessionService(fakePrisma, mockConfig as any, mockMetrics as any),
        },
        { provide: BriefGeneratorService, useValue: mockBriefGen as any },
        { provide: AuditService, useValue: mockAudit as any },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(false);
    await app.init();
    httpServer = app.getHttpServer();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sessions.clear();
    records.length = 0;
    sessionCounter = 0;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('completes a fresh INITIATED kiosk session (FSM fast-forward + patientId persist)', async () => {
    // Kiosk creates the session BEFORE face match — no patientId.
    const created = await request(httpServer)
      .post('/intake/session')
      .send({ deviceId: 'kiosk-regression-1' })
      .expect(201);
    const sessionId = created.body.id as string;
    expect(created.body.status).toBe('INITIATED');

    // Complete with the matched patientId (as the fixed frontend sends it).
    const res = await request(httpServer)
      .post(`/intake/session/${sessionId}/complete`)
      .send(validIntakeData)
      .expect(200);

    expect(res.body.intakeRecord.patientId).toBe(PATIENT_ID);
    expect(res.body.brief.summary).toBe(fixedBrief.summary);

    // The REAL SessionService FSM walked the full chain — this is the exact
    // sequence that used to 400 on a fresh session.
    const statusUpdates = fakePrisma.intakeSession.update.mock.calls
      .map((c: any[]) => c[0]?.data?.status)
      .filter(Boolean);
    expect(statusUpdates).toEqual([
      'FACE_MATCHED',
      'CONTEXT_LOADED',
      'INTAKE_IN_PROGRESS',
      'TRANSCRIBING',
      'BRIEF_GENERATED',
    ]);

    // The patientId was persisted onto the session (DB is authoritative).
    const finalSession = sessions.get(sessionId);
    expect(finalSession.status).toBe('BRIEF_GENERATED');
    expect(finalSession.patientId).toBe(PATIENT_ID);
  });

  it('rejects completion with a clear 400 when no patient is identified', async () => {
    const created = await request(httpServer)
      .post('/intake/session')
      .send({ deviceId: 'kiosk-regression-2' })
      .expect(201);
    const sessionId = created.body.id as string;

    const { patientId: _dropped, ...withoutPatient } = validIntakeData;
    const res = await request(httpServer)
      .post(`/intake/session/${sessionId}/complete`)
      .send(withoutPatient)
      .expect(400);

    expect(JSON.stringify(res.body)).toMatch(/Patient not identified/i);
    expect(records.length).toBe(0); // nothing written
  });

  it('still enforces the FSM — a TIMED_OUT session cannot be completed', async () => {
    sessions.set('timeout-session', {
      id: 'timeout-session',
      patientId: PATIENT_ID,
      status: 'TIMED_OUT',
      startedAt: new Date(),
      endedAt: null,
    });

    await request(httpServer)
      .post('/intake/session/timeout-session/complete')
      .send(validIntakeData)
      .expect(400);
  });

  it('returns the existing record on idempotent replay without re-transitioning', async () => {
    const created = await request(httpServer)
      .post('/intake/session')
      .send({ deviceId: 'kiosk-regression-3' })
      .expect(201);
    const sessionId = created.body.id as string;

    await request(httpServer)
      .post(`/intake/session/${sessionId}/complete`)
      .send(validIntakeData)
      .expect(200);

    // Offline outbox replays the same completion with an Idempotency-Key.
    const updatesBefore = fakePrisma.intakeSession.update.mock.calls.length;
    const replay = await request(httpServer)
      .post(`/intake/session/${sessionId}/complete`)
      .set('Idempotency-Key', 'outbox-key-1')
      .send(validIntakeData)
      .expect(200);

    expect(replay.body.intakeRecord.id).toBeDefined();
    expect(fakePrisma.intakeSession.update.mock.calls.length).toBe(updatesBefore); // no re-transition
    expect(records.length).toBe(1); // no duplicate record
  });
});
