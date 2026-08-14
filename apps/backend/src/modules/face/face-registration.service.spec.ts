import { Test, type TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { FaceRegistrationService } from './face-registration.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FaceService } from './face.service';
import { AuditService } from '../audit/audit.service';

// ─── Mocks ─────────────────────────────────────────────────────

const mockPrisma = {
  patient: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  faceEmbedding: {
    create: jest.fn(),
  },
};

const mockFaceService = {
  upsertEmbedding: jest.fn(),
  searchByFace: jest.fn(),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

// ─── Test Data ──────────────────────────────────────────────────

const validPatientId = '660e8400-e29b-41d4-a716-446655440001';

const registrationDto = {
  name: 'Priya Sharma',
  dob: '1990-01-15',
  mobile: '+919876543210',
  consent: true,
  embedding: new Array(512).fill(0.1),
};

const existingPatient = {
  id: validPatientId,
  name: 'Priya Sharma',
  dob: new Date('1990-01-15'),
  mobile: '+919876543210',
  consentGranted: true,
};

const softDeletedPatient = {
  ...existingPatient,
  isDeleted: true,
  deletedAt: new Date('2026-08-01T10:00:00Z'),
};

const restoredPatient = {
  ...existingPatient,
  isDeleted: false,
  deletedAt: null,
};

describe('FaceRegistrationService', () => {
  let service: FaceRegistrationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaceRegistrationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FaceService, useValue: mockFaceService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<FaceRegistrationService>(FaceRegistrationService);
  });

  // ─── Register Patient ─────────────────────────────────────────

  describe('registerPatient', () => {
    it('should register a new patient, store embedding, and audit', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);
      mockPrisma.patient.create.mockResolvedValue(existingPatient);
      mockFaceService.upsertEmbedding.mockResolvedValue(undefined);
      mockPrisma.faceEmbedding.create.mockResolvedValue({ id: 'emb-1', patientId: validPatientId });

      const result = await service.registerPatient(registrationDto);

      expect(result).toEqual({
        id: validPatientId,
        name: 'Priya Sharma',
        message: 'Patient registered successfully',
      });
      expect(mockPrisma.patient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Priya Sharma',
          mobile: '+919876543210',
          consentGranted: true,
        }),
      });
      expect(mockFaceService.upsertEmbedding).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: validPatientId,
          vector: registrationDto.embedding,
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PATIENT_REGISTERED',
          resourceId: validPatientId,
        }),
      );
    });

    it('should throw ConflictException when mobile already exists (no idempotency key)', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(existingPatient);

      await expect(service.registerPatient(registrationDto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.patient.create).not.toHaveBeenCalled();
      expect(mockFaceService.upsertEmbedding).not.toHaveBeenCalled();
    });

    it('should return the existing patient on idempotent replay (mobile exists + key)', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(existingPatient);

      const result = await service.registerPatient(registrationDto, 'offline-mutation-7');

      expect(result).toEqual({
        id: validPatientId,
        name: 'Priya Sharma',
        message: 'Patient already registered (idempotent replay)',
      });
      // No duplicate writes.
      expect(mockPrisma.patient.create).not.toHaveBeenCalled();
      expect(mockFaceService.upsertEmbedding).not.toHaveBeenCalled();
    });

    it('should restore a soft-deleted patient on re-registration instead of 409', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(softDeletedPatient);
      mockPrisma.patient.update.mockResolvedValue(restoredPatient);
      mockFaceService.upsertEmbedding.mockResolvedValue(undefined);
      mockPrisma.faceEmbedding.create.mockResolvedValue({ id: 'emb-2', patientId: validPatientId });

      const result = await service.registerPatient(registrationDto);

      expect(result).toEqual({
        id: validPatientId,
        name: 'Priya Sharma',
        message: 'Patient restored',
      });
      expect(mockPrisma.patient.update).toHaveBeenCalledWith({
        where: { id: validPatientId },
        data: expect.objectContaining({
          isDeleted: false,
          deletedAt: null,
          name: 'Priya Sharma',
        }),
      });
      expect(mockPrisma.patient.create).not.toHaveBeenCalled();
    });

    it('should propagate database errors', async () => {
      mockPrisma.patient.findUnique.mockRejectedValue(new Error('DB connection failed'));

      await expect(service.registerPatient(registrationDto)).rejects.toThrow(
        'DB connection failed',
      );
    });
  });

  // ─── Search With Details ──────────────────────────────────────

  describe('searchWithDetails', () => {
    it('should return empty matches when nothing found', async () => {
      mockFaceService.searchByFace.mockResolvedValue([]);

      const result = await service.searchWithDetails(new Array(512).fill(0.1));

      expect(result).toEqual({ matches: [], total: 0 });
    });

    it('should enrich matches with patient details', async () => {
      mockFaceService.searchByFace.mockResolvedValue([{ patientId: validPatientId, score: 0.94 }]);
      mockPrisma.patient.findMany.mockResolvedValue([existingPatient]);

      const result = await service.searchWithDetails(new Array(512).fill(0.1));

      expect(result.total).toBe(1);
      expect(result.matches[0]).toEqual(
        expect.objectContaining({
          patientId: validPatientId,
          score: 0.94,
          patientName: 'Priya Sharma',
          mobile: '+919876543210',
        }),
      );
      // Soft-deleted patients are excluded from face-match enrichment.
      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith({
        where: { id: { in: [validPatientId] }, isDeleted: false },
        select: expect.any(Object),
      });
    });
  });

  // ─── Soft Delete ──────────────────────────────────────────────

  describe('softDeletePatient', () => {
    it('should mark a patient soft-deleted and return true', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: validPatientId, isDeleted: false });
      mockPrisma.patient.update.mockResolvedValue({
        ...existingPatient,
        isDeleted: true,
        deletedAt: new Date(),
      });

      const result = await service.softDeletePatient(validPatientId);

      expect(result).toBe(true);
      expect(mockPrisma.patient.update).toHaveBeenCalledWith({
        where: { id: validPatientId },
        data: expect.objectContaining({ isDeleted: true, deletedAt: expect.any(Date) }),
      });
    });

    it('should return false for an already-deleted patient (idempotent)', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: validPatientId, isDeleted: true });

      const result = await service.softDeletePatient(validPatientId);

      expect(result).toBe(false);
      expect(mockPrisma.patient.update).not.toHaveBeenCalled();
    });

    it('should return false when the patient does not exist', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      const result = await service.softDeletePatient('missing-patient');

      expect(result).toBe(false);
      expect(mockPrisma.patient.update).not.toHaveBeenCalled();
    });
  });
});
