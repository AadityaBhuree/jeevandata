import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FaceService } from './face.service';
import { AuditService } from '../audit/audit.service';
import type { RegisterPatientDto } from './dto/register-patient.dto';

@Injectable()
export class FaceRegistrationService {
  private readonly logger = new Logger(FaceRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faceService: FaceService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Register a new patient with their face embedding.
   * Creates the patient record in PostgreSQL and stores the embedding in Qdrant.
   *
   * When an `idempotencyKey` is supplied (offline outbox replay) and the
   * patient already exists, the existing record is returned instead of a 409
   * — the first delivery already created the patient even if its response was
   * lost in transit.
   */
  async registerPatient(data: RegisterPatientDto, idempotencyKey?: string) {
    // Check for duplicate mobile — a soft-deleted patient is re-activated
    // (restored) rather than blocking re-registration, since healthcare
    // retention rules keep the record but the patient may return later.
    const existing = await this.prisma.patient.findUnique({
      where: { mobile: data.mobile },
    });

    if (existing) {
      if (idempotencyKey) {
        this.logger.log(
          `Idempotent replay: patient ${existing.id} already registered (key ${idempotencyKey})`,
        );
        return {
          id: existing.id,
          name: existing.name,
          message: 'Patient already registered (idempotent replay)',
        };
      }

      if (existing.isDeleted) {
        const restored = await this.prisma.patient.update({
          where: { id: existing.id },
          data: {
            isDeleted: false,
            deletedAt: null,
            name: data.name,
            dob: new Date(data.dob),
            consentGranted: data.consent,
          },
        });
        this.logger.log(`Restored soft-deleted patient ${restored.id} on re-registration`);
        await this.faceService.upsertEmbedding({
          patientId: restored.id,
          vector: data.embedding,
          capturedAt: new Date().toISOString(),
        });
        await this.prisma.faceEmbedding.create({
          data: { patientId: restored.id },
        });
        return { id: restored.id, name: restored.name, message: 'Patient restored' };
      }

      throw new ConflictException(
        `Patient with mobile ${data.mobile} already exists (ID: ${existing.id})`,
      );
    }

    // Create patient record
    const patient = await this.prisma.patient.create({
      data: {
        name: data.name,
        dob: new Date(data.dob),
        mobile: data.mobile,
        consentGranted: data.consent,
      },
    });

    // Store face embedding in Qdrant
    await this.faceService.upsertEmbedding({
      patientId: patient.id,
      vector: data.embedding,
      capturedAt: new Date().toISOString(),
    });

    // Record face embedding metadata in PostgreSQL
    await this.prisma.faceEmbedding.create({
      data: {
        patientId: patient.id,
      },
    });

    this.logger.log(`Registered patient ${patient.id} (${patient.name}) with face embedding`);

    await this.auditService.log({
      action: 'PATIENT_REGISTERED',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'patient',
      resourceId: patient.id,
      details: { name: patient.name, mobile: patient.mobile, consent: data.consent },
      ipAddress: 'internal',
    });

    return {
      id: patient.id,
      name: patient.name,
      message: 'Patient registered successfully',
    };
  }

  /**
   * Search for a patient by face embedding and return their details if matched.
   */
  async searchWithDetails(vector: number[], threshold = 0.82, limit = 5) {
    const matches = await this.faceService.searchByFace({
      vector,
      threshold,
      limit,
    });

    if (matches.length === 0) {
      return { matches: [] as Array<Record<string, unknown>>, total: 0 };
    }

    // Fetch patient details for each match
    const patientIds = matches.map((m) => m.patientId);
    const patients = await this.prisma.patient.findMany({
      where: { id: { in: patientIds }, isDeleted: false },
      select: {
        id: true,
        name: true,
        dob: true,
        mobile: true,
      },
    });

    const patientMap = new Map(patients.map((p) => [p.id, p]));

    const results = matches
      .filter((m) => patientMap.has(m.patientId))
      .map((m) => {
        const patient = patientMap.get(m.patientId)!;
        return {
          patientId: m.patientId,
          score: m.score,
          patientName: patient.name,
          dob: patient.dob.toISOString().split('T')[0],
          mobile: patient.mobile,
        };
      });

    await this.auditService.log({
      action: 'PATIENT_SEARCH_WITH_DETAILS',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'patient',
      resourceId: 'batch',
      details: { matchCount: matches.length, resultCount: results.length, threshold },
      ipAddress: 'internal',
    });

    return { matches: results, total: results.length };
  }

  /**
   * Soft-delete a patient record (healthcare retention compliance).
   *
   * The row stays in the database with `isDeleted = true` / `deletedAt` set so
   * audit trails and historical intake records remain intact. All queries that
   * surface patient data filter soft-deleted rows out by default.
   *
   * Returns false when the patient doesn't exist or was already deleted.
   */
  async softDeletePatient(patientId: string): Promise<boolean> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, isDeleted: true },
    });

    if (!patient || patient.isDeleted) {
      return false;
    }

    await this.prisma.patient.update({
      where: { id: patientId },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    this.logger.log(`Soft-deleted patient ${patientId}`);
    return true;
  }
}
