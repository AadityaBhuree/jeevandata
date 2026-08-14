import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PmsService } from './pms.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { HL7FHIRAdapter } from './adapters/hl7-fhir.adapter';
import { CustomApiAdapter } from './adapters/custom-api.adapter';
import type { PmsSyncInput } from '@jeevandata/shared-schemas';
import type { SyncResult } from './adapters/pms-sync-adapter';

// ─── Mocks ─────────────────────────────────────────────────────

const mockPrisma = {
  patient: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  pmsPatientCache: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockHL7FHIRAdapter = {
  targetSystem: 'hl7_fhir' as const,
  sync: jest.fn(),
};

const mockCustomApiAdapter = {
  targetSystem: 'custom' as const,
  sync: jest.fn(),
};

// ─── Test Data ──────────────────────────────────────────────────

const validPatientId = '660e8400-e29b-41d4-a716-446655440001';
const validSessionId = '550e8400-e29b-41d4-a716-446655440000';
const validIntakeRecordId = '770e8400-e29b-41d4-a716-446655440002';
const validExternalId = 'ext-12345';

const now = new Date('2025-01-15T10:30:00Z');

describe('PmsService', () => {
  let service: PmsService;

  const mockConfig: Record<string, unknown> = {
    'pms.cacheTtlMs': 86_400_000, // 24h
    'pms.fhirEndpoint': 'http://fhir.example.com',
    'pms.customEndpoint': 'http://custom.example.com',
    'pms.apiKey': 'test-api-key',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PmsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => mockConfig[key] ?? defaultValue),
          },
        },
        { provide: AuditService, useValue: mockAuditService },
        { provide: HL7FHIRAdapter, useValue: mockHL7FHIRAdapter },
        { provide: CustomApiAdapter, useValue: mockCustomApiAdapter },
      ],
    }).compile();

    service = module.get<PmsService>(PmsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Sync To PMS ──────────────────────────────────────────────

  describe('syncToPms', () => {
    const validPayload: PmsSyncInput = {
      sessionId: validSessionId,
      patientId: validPatientId,
      intakeRecordId: validIntakeRecordId,
      targetSystem: 'custom',
    };

    const successResult: SyncResult = {
      synced: true,
      target: 'custom',
      externalId: validExternalId,
      durationMs: 150,
    };

    const failResult: SyncResult = {
      synced: false,
      target: 'custom',
      error: 'PMS server returned 500',
    };

    it('should sync to PMS successfully via custom adapter', async () => {
      mockCustomApiAdapter.sync.mockResolvedValue(successResult);

      const result = await service.syncToPms(validPayload);

      expect(result.synced).toBe(true);
      expect(result.externalId).toBe(validExternalId);
      expect(mockCustomApiAdapter.sync).toHaveBeenCalledWith(validPayload);
    });

    it('should sync to PMS successfully via HL7 FHIR adapter', async () => {
      mockHL7FHIRAdapter.sync.mockResolvedValue({
        ...successResult,
        target: 'hl7_fhir',
      });

      const result = await service.syncToPms({
        ...validPayload,
        targetSystem: 'hl7_fhir',
      });

      expect(result.synced).toBe(true);
      expect(mockHL7FHIRAdapter.sync).toHaveBeenCalled();
      expect(mockCustomApiAdapter.sync).not.toHaveBeenCalled();
    });

    it('should return error for unknown target system', async () => {
      const result = await service.syncToPms({
        ...validPayload,
        targetSystem: 'unknown-system' as unknown as PmsSyncInput['targetSystem'],
      });

      expect(result.synced).toBe(false);
      expect(result.error).toContain('Unknown target system');
      expect(mockCustomApiAdapter.sync).not.toHaveBeenCalled();
      expect(mockHL7FHIRAdapter.sync).not.toHaveBeenCalled();
    });

    it('should write-through cache on successful sync', async () => {
      mockCustomApiAdapter.sync.mockResolvedValue(successResult);

      await service.syncToPms(validPayload);

      expect(mockPrisma.pmsPatientCache.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId: validPatientId },
          create: expect.objectContaining({
            patientId: validPatientId,
          }),
        }),
      );
    });

    it('should log audit on successful sync', async () => {
      mockCustomApiAdapter.sync.mockResolvedValue(successResult);

      await service.syncToPms(validPayload);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PMS_SYNC_SUCCESS',
          resourceId: validIntakeRecordId,
        }),
      );
    });

    it('should log audit on failed sync', async () => {
      mockCustomApiAdapter.sync.mockResolvedValue(failResult);

      await service.syncToPms(validPayload);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PMS_SYNC_FAILED',
          resourceId: validIntakeRecordId,
        }),
      );
    });

    it('should NOT write-through cache on failed sync', async () => {
      mockCustomApiAdapter.sync.mockResolvedValue(failResult);

      await service.syncToPms(validPayload);

      expect(mockPrisma.pmsPatientCache.upsert).not.toHaveBeenCalled();
    });

    it('should log audit for unknown target system error', async () => {
      await service.syncToPms({
        ...validPayload,
        targetSystem: 'unknown' as unknown as PmsSyncInput['targetSystem'],
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PMS_SYNC_FAILED',
          details: expect.objectContaining({
            error: 'Unknown target system',
          }),
        }),
      );
    });
  });

  // ─── Load Patient Context ─────────────────────────────────────

  describe('loadPatientContext', () => {
    const mockPatient = {
      id: validPatientId,
      name: 'Priya Sharma',
      dob: new Date('1990-01-15'),
      mobile: '+919876543210',
      consentGranted: true,
    };

    it('should return cached context on cache hit', async () => {
      mockPrisma.pmsPatientCache.findUnique.mockResolvedValue({
        patientId: validPatientId,
        data: { demographics: { name: 'Priya Sharma' } },
        lastSyncedAt: now,
      });

      const result = await service.loadPatientContext(validPatientId);

      expect(result).not.toBeNull();
      expect(result!.demographics).toHaveProperty('name', 'Priya Sharma');
      expect(mockPrisma.patient.findFirst).not.toHaveBeenCalled();
    });

    it('should load from DB on cache miss and write-through', async () => {
      mockPrisma.pmsPatientCache.findUnique.mockResolvedValue(null);
      mockPrisma.patient.findFirst.mockResolvedValue(mockPatient);

      const result = await service.loadPatientContext(validPatientId);

      expect(result).not.toBeNull();
      expect(result!.demographics.name).toBe('Priya Sharma');
      expect(result!.demographics.mobile).toBe('+919876543210');
      expect(mockPrisma.pmsPatientCache.upsert).toHaveBeenCalled();
    });

    it('should return null when patient not found in DB', async () => {
      mockPrisma.pmsPatientCache.findUnique.mockResolvedValue(null);
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      const result = await service.loadPatientContext(validPatientId);

      expect(result).toBeNull();
    });

    it('should treat stale cache (beyond TTL) as cache miss', async () => {
      const staleDate = new Date(now.getTime() - 86_400_001); // 1ms over 24h
      mockPrisma.pmsPatientCache.findUnique.mockResolvedValue({
        patientId: validPatientId,
        data: { demographics: { name: 'Old Data' } },
        lastSyncedAt: staleDate,
      });
      mockPrisma.patient.findFirst.mockResolvedValue(mockPatient);

      const result = await service.loadPatientContext(validPatientId);

      // Should have gone to DB despite having stale cache
      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ isDeleted: false }),
      });
      expect(result!.demographics.name).toBe('Priya Sharma'); // Fresh data
    });

    it('should log audit event on cache hit', async () => {
      mockPrisma.pmsPatientCache.findUnique.mockResolvedValue({
        patientId: validPatientId,
        data: { demographics: { name: 'Priya' } },
        lastSyncedAt: now,
      });

      await service.loadPatientContext(validPatientId);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PMS_CONTEXT_CACHE_HIT',
          resourceId: validPatientId,
        }),
      );
    });

    it('should log audit event on context load from DB', async () => {
      mockPrisma.pmsPatientCache.findUnique.mockResolvedValue(null);
      mockPrisma.patient.findFirst.mockResolvedValue(mockPatient);

      await service.loadPatientContext(validPatientId);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PMS_CONTEXT_LOADED',
          resourceId: validPatientId,
        }),
      );
    });

    it('should include visit history and risk flags (empty by default)', async () => {
      mockPrisma.pmsPatientCache.findUnique.mockResolvedValue(null);
      mockPrisma.patient.findFirst.mockResolvedValue(mockPatient);

      const result = await service.loadPatientContext(validPatientId);

      expect(result!.visitHistory).toEqual([]);
      expect(result!.chronicConditions).toEqual([]);
      expect(result!.currentMedications).toEqual([]);
      expect(result!.riskFlags).toEqual([]);
      expect(result!.upcomingAppointment).toBeNull();
    });
  });

  // ─── Get Last Sync Info ───────────────────────────────────────

  describe('getLastSyncInfo', () => {
    it('should return sync info from cache', async () => {
      mockPrisma.pmsPatientCache.findUnique.mockResolvedValue({
        patientId: validPatientId,
        data: {
          syncMeta: {
            targetSystem: 'custom',
            externalId: validExternalId,
          },
        },
        lastSyncedAt: now,
      });

      const result = await service.getLastSyncInfo(validPatientId);

      expect(result.lastSyncedAt).toBe(now.toISOString());
      expect(result.targetSystem).toBe('custom');
      expect(result.externalId).toBe(validExternalId);
    });

    it('should return null lastSyncedAt when no cache exists', async () => {
      mockPrisma.pmsPatientCache.findUnique.mockResolvedValue(null);

      const result = await service.getLastSyncInfo(validPatientId);

      expect(result.lastSyncedAt).toBeNull();
      expect(result.targetSystem).toBeUndefined();
      expect(result.externalId).toBeUndefined();
    });

    it('should return null values on database error', async () => {
      mockPrisma.pmsPatientCache.findUnique.mockRejectedValue(new Error('DB connection failed'));

      const result = await service.getLastSyncInfo(validPatientId);

      expect(result.lastSyncedAt).toBeNull();
    });

    it('should extract syncMeta from data field', async () => {
      mockPrisma.pmsPatientCache.findUnique.mockResolvedValue({
        patientId: validPatientId,
        data: { unrelated: 'data' },
        lastSyncedAt: now,
      });

      const result = await service.getLastSyncInfo(validPatientId);

      expect(result.lastSyncedAt).toBe(now.toISOString());
      expect(result.targetSystem).toBeUndefined();
      expect(result.externalId).toBeUndefined();
    });
  });
});
