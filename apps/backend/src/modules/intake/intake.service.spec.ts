import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { IntakeService } from './intake.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { BriefGeneratorService } from '../ai/brief-generator.service';
import { AuditService } from '../audit/audit.service';

// ─── Mocks ─────────────────────────────────────────────────────

const mockPrisma = {
  intakeSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  intakeRecord: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
};

const mockSessionService = {
  updateStatus: jest.fn(),
  getCachedStatus: jest.fn(),
  cachePatientContext: jest.fn(),
  getCachedPatientContext: jest.fn(),
  handleInactivityTimeout: jest.fn(),
};

const mockBriefGeneratorService = {
  generate: jest.fn().mockResolvedValue({
    summary: 'Patient presents with Headache and fever for 3 days.',
    chiefComplaint: 'Headache and fever',
    riskFlags: [],
    vitalsToCheck: ['Blood Pressure', 'Heart Rate', 'Temperature'],
    suggestedFollowups: [],
    medicationsNote: '',
    icd10Hints: [],
  }),
};

describe('IntakeService', () => {
  let service: IntakeService;

  const validSessionId = '550e8400-e29b-41d4-a716-446655440000';
  const validPatientId = '660e8400-e29b-41d4-a716-446655440001';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntakeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SessionService, useValue: mockSessionService },
        { provide: BriefGeneratorService, useValue: mockBriefGeneratorService },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<IntakeService>(IntakeService);
  });

  // ─── Start Session ──────────────────────────────────────────

  describe('startSession', () => {
    it('should create a new session with INITIATED status', async () => {
      const createdSession = {
        id: validSessionId,
        patientId: null,
        status: 'INITIATED',
        deviceId: 'web-cam-1',
        metadata: {},
        startedAt: new Date(),
      };

      mockPrisma.intakeSession.create.mockResolvedValue(createdSession);

      const result = await service.startSession({
        deviceId: 'web-cam-1',
        metadata: {},
      });

      expect(result).toEqual(createdSession);
      expect(mockPrisma.intakeSession.create).toHaveBeenCalledWith({
        data: {
          patientId: null,
          status: 'INITIATED',
          deviceId: 'web-cam-1',
          metadata: {},
        },
      });
    });

    it('should create a session with a patientId when provided', async () => {
      mockPrisma.intakeSession.create.mockResolvedValue({
        id: validSessionId,
        patientId: validPatientId,
        status: 'INITIATED',
      });

      await service.startSession({
        patientId: validPatientId,
        deviceId: 'kiosk-01',
        metadata: {},
      });

      expect(mockPrisma.intakeSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patientId: validPatientId,
        }),
      });
    });

    it('should use empty object for metadata when not provided', async () => {
      mockPrisma.intakeSession.create.mockResolvedValue({
        id: validSessionId,
        status: 'INITIATED',
      });

      await service.startSession({
        deviceId: 'cam-1',
        metadata: {},
      });

      expect(mockPrisma.intakeSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: {},
        }),
      });
    });
  });

  // ─── Get Session ─────────────────────────────────────────────

  describe('getSession', () => {
    it('should return the session with related records', async () => {
      const mockSession = {
        id: validSessionId,
        status: 'INTAKE_IN_PROGRESS',
        intakeRecords: [],
        transcripts: [],
      };

      mockPrisma.intakeSession.findUnique.mockResolvedValue(mockSession);

      const result = await service.getSession(validSessionId);

      expect(result).toEqual(mockSession);
      expect(mockPrisma.intakeSession.findUnique).toHaveBeenCalledWith({
        where: { id: validSessionId },
        include: {
          intakeRecords: true,
          transcripts: {
            orderBy: { timestampMs: 'asc' },
            take: 100,
          },
        },
      });
    });

    it('should throw NotFoundException when session does not exist', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue(null);

      await expect(service.getSession(validSessionId)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Complete With Intake ────────────────────────────────────

  describe('completeWithIntake', () => {
    const mockIntakeData = {
      chiefComplaint: 'Headache and fever',
      symptoms: [{ name: 'Headache', duration: '3 days', severity: 6 }],
      associated: ['Fatigue'],
      medicationChanges: 'None',
      allergyUpdates: 'None',
      patientNotes: '',
    };

    const mockSession = {
      id: validSessionId,
      patientId: validPatientId,
      status: 'INTAKE_IN_PROGRESS',
      startedAt: new Date(),
    };

    it('should complete the full intake flow successfully', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue(mockSession); // single call: check session
      mockSessionService.updateStatus.mockResolvedValue(undefined);
      mockPrisma.intakeRecord.create.mockResolvedValue({
        id: 'record-1',
        sessionId: validSessionId,
        patientId: validPatientId,
      });

      const result = await service.completeWithIntake(validSessionId, mockIntakeData);

      // Verify FSM transition to TRANSCRIBING
      expect(mockSessionService.updateStatus).toHaveBeenCalledWith(validSessionId, 'TRANSCRIBING');

      // Verify intake record was created
      expect(mockPrisma.intakeRecord.create).toHaveBeenCalledWith({
        data: {
          sessionId: validSessionId,
          patientId: validPatientId,
          brief: expect.any(Object),
          intakeData: mockIntakeData,
        },
      });

      // Verify FSM transition to BRIEF_GENERATED
      expect(mockSessionService.updateStatus).toHaveBeenCalledWith(
        validSessionId,
        'BRIEF_GENERATED',
      );

      // Verify the clinical brief was generated
      expect(result.brief).toBeDefined();
      const brief = result.brief as {
        summary: string;
        chiefComplaint: string;
        vitalsToCheck: string[];
      };
      expect(brief.summary).toContain('Headache and fever');
      expect(brief.chiefComplaint).toBe('Headache and fever');
      expect(brief.vitalsToCheck).toContain('Blood Pressure');
    });

    it('should throw NotFoundException when session does not exist', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue(null);

      await expect(service.completeWithIntake(validSessionId, mockIntakeData)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockSessionService.updateStatus).not.toHaveBeenCalled();
      expect(mockPrisma.intakeRecord.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when session is already completed', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'COMPLETED',
      });

      await expect(service.completeWithIntake(validSessionId, mockIntakeData)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockSessionService.updateStatus).not.toHaveBeenCalled();
      expect(mockPrisma.intakeRecord.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when brief is already generated', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'BRIEF_GENERATED',
      });

      await expect(service.completeWithIntake(validSessionId, mockIntakeData)).rejects.toThrow(
        'Session is already completed',
      );
    });

    it('should return the existing record on idempotent replay (completed + key)', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'BRIEF_GENERATED',
      });
      const existingRecord = {
        id: 'record-1',
        sessionId: validSessionId,
        patientId: validPatientId,
        brief: { summary: 'Existing brief' },
        intakeData: mockIntakeData,
      };
      mockPrisma.intakeRecord.findFirst.mockResolvedValue(existingRecord);

      const result = await service.completeWithIntake(
        validSessionId,
        mockIntakeData,
        'offline-mutation-42',
      );

      expect(result.intakeRecord).toEqual(existingRecord);
      expect(result.brief).toEqual(existingRecord.brief);
      // No re-transition, no duplicate record creation.
      expect(mockSessionService.updateStatus).not.toHaveBeenCalled();
      expect(mockPrisma.intakeRecord.create).not.toHaveBeenCalled();
      expect(mockPrisma.intakeRecord.findFirst).toHaveBeenCalledWith({
        where: { sessionId: validSessionId },
        orderBy: { generatedAt: 'desc' },
      });
    });

    it('should still throw when completed with a key but no existing record found', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'COMPLETED',
      });
      mockPrisma.intakeRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.completeWithIntake(validSessionId, mockIntakeData, 'offline-mutation-42'),
      ).rejects.toThrow('Session is already completed');
    });

    it('should throw BadRequestException on a completed session WITHOUT an idempotency key', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'BRIEF_GENERATED',
      });

      await expect(service.completeWithIntake(validSessionId, mockIntakeData)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.intakeRecord.findFirst).not.toHaveBeenCalled();
    });

    it('should reject completion when no patient is identified (no patientId anywhere)', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        ...mockSession,
        patientId: null,
      });
      mockSessionService.updateStatus.mockResolvedValue(undefined);

      await expect(service.completeWithIntake(validSessionId, mockIntakeData)).rejects.toThrow(
        BadRequestException,
      );

      // The IntakeRecord.patientId FK is a required UUID — writing '' used to
      // 500 with an invalid-UUID error; now it fails fast with a clear 400.
      expect(mockPrisma.intakeRecord.create).not.toHaveBeenCalled();
    });

    it('should use the patientId from the complete payload when the session has none', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        ...mockSession,
        patientId: null,
      });
      mockSessionService.updateStatus.mockResolvedValue(undefined);
      mockPrisma.intakeRecord.create.mockResolvedValue({
        id: 'record-1',
        sessionId: validSessionId,
        patientId: validPatientId,
      });
      mockPrisma.intakeSession.update.mockResolvedValue({});

      const result = await service.completeWithIntake(validSessionId, {
        ...mockIntakeData,
        patientId: validPatientId,
      });

      // patientId is persisted onto the session for later references…
      expect(mockPrisma.intakeSession.update).toHaveBeenCalledWith({
        where: { id: validSessionId },
        data: { patientId: validPatientId },
      });
      // …and used for the intake record's required FK.
      expect(mockPrisma.intakeRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patientId: validPatientId,
        }),
      });
      expect(result.intakeRecord.patientId).toBe(validPatientId);
    });
  });

  // ─── Error Propagation ────────────────────────────────────────

  describe('startSession — error propagation', () => {
    it('should propagate Prisma errors during session creation', async () => {
      mockPrisma.intakeSession.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.startSession({ deviceId: 'cam-1', metadata: {} })).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should propagate Prisma errors during session retrieval', async () => {
      mockPrisma.intakeSession.findUnique.mockRejectedValue(new Error('Query timeout'));

      await expect(service.getSession(validSessionId)).rejects.toThrow('Query timeout');
    });

    it('should propagate Prisma errors during intake record creation', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        id: validSessionId,
        patientId: validPatientId,
        status: 'INTAKE_IN_PROGRESS',
        startedAt: new Date(),
      });
      mockSessionService.updateStatus.mockResolvedValue(undefined);
      mockPrisma.intakeRecord.create.mockRejectedValue(new Error('Record creation failed'));

      const mockIntakeData = {
        chiefComplaint: 'Test',
        symptoms: [],
        associated: [],
        medicationChanges: '',
        allergyUpdates: '',
        patientNotes: '',
      };

      await expect(service.completeWithIntake(validSessionId, mockIntakeData)).rejects.toThrow(
        'Record creation failed',
      );
    });
  });

  // ─── Get Session Status ──────────────────────────────────────

  describe('getSessionStatus', () => {
    it('should return status, id, and updatedAt for a valid session', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue({
        id: validSessionId,
        status: 'FACE_MATCHED',
        updatedAt: new Date('2025-01-15T10:30:00Z'),
      });

      const result = await service.getSessionStatus(validSessionId);

      expect(result).toEqual({
        id: validSessionId,
        status: 'FACE_MATCHED',
        updatedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException when session does not exist', async () => {
      mockPrisma.intakeSession.findUnique.mockResolvedValue(null);

      await expect(service.getSessionStatus('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
