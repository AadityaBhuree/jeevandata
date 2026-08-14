import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { PrismaService } from '../../prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { AuditService } from '../audit/audit.service';
import type { PmsSyncInput } from '@jeevandata/shared-schemas';
import type { PatientContext } from '@jeevandata/shared-types';
import type { Prisma } from '@prisma/client';
import type { PmsSyncAdapter, SyncResult } from './adapters/pms-sync-adapter';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { HL7FHIRAdapter } from './adapters/hl7-fhir.adapter';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { CustomApiAdapter } from './adapters/custom-api.adapter';

@Injectable()
export class PmsService {
  private readonly logger = new Logger(PmsService.name);
  private readonly adapters: Map<string, PmsSyncAdapter> = new Map();
  private readonly cacheTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    hl7FhirAdapter: HL7FHIRAdapter,
    customApiAdapter: CustomApiAdapter,
  ) {
    // Register available sync adapters
    this.adapters.set(hl7FhirAdapter.targetSystem, hl7FhirAdapter);
    this.adapters.set(customApiAdapter.targetSystem, customApiAdapter);

    this.cacheTtlMs = this.configService.get<number>('pms.cacheTtlMs', 86_400_000); // 24h default
  }

  /**
   * Sync intake data to the target PMS/EMR system.
   * Uses the appropriate adapter based on targetSystem, with write-through cache.
   */
  async syncToPms(
    data: PmsSyncInput & {
      intakeData?: Record<string, unknown>;
      patientDemographics?: Record<string, unknown>;
    },
  ): Promise<SyncResult> {
    this.logger.log(`Syncing intake ${data.intakeRecordId} to PMS: ${data.targetSystem}`);

    const adapter = this.adapters.get(data.targetSystem);
    if (!adapter) {
      this.logger.error(`Unknown target system: ${data.targetSystem}`);

      await this.auditService.log({
        action: 'PMS_SYNC_FAILED',
        actorId: 'system',
        actorRole: 'SYSTEM',
        resourceType: 'pms_sync',
        resourceId: data.intakeRecordId,
        details: {
          targetSystem: data.targetSystem,
          error: 'Unknown target system',
          availableAdapters: Array.from(this.adapters.keys()),
        },
        ipAddress: 'internal',
      });

      return {
        synced: false,
        target: data.targetSystem,
        error: `Unknown target system: ${data.targetSystem}. Available: ${Array.from(this.adapters.keys()).join(', ')}`,
      };
    }

    // Execute sync via the adapter
    const result = await adapter.sync(data);

    // Write-through cache: persist sync metadata to database
    if (result.synced) {
      await this.updateSyncCache(data.patientId, {
        lastSyncedAt: new Date().toISOString(),
        targetSystem: data.targetSystem,
        externalId: result.externalId,
        durationMs: result.durationMs,
      });

      await this.auditService.log({
        action: 'PMS_SYNC_SUCCESS',
        actorId: 'system',
        actorRole: 'SYSTEM',
        resourceType: 'pms_sync',
        resourceId: data.intakeRecordId,
        details: {
          targetSystem: data.targetSystem,
          patientId: data.patientId,
          externalId: result.externalId,
          durationMs: result.durationMs,
        },
        ipAddress: 'internal',
      });
    } else {
      await this.auditService.log({
        action: 'PMS_SYNC_FAILED',
        actorId: 'system',
        actorRole: 'SYSTEM',
        resourceType: 'pms_sync',
        resourceId: data.intakeRecordId,
        details: {
          targetSystem: data.targetSystem,
          patientId: data.patientId,
          error: result.error,
        },
        ipAddress: 'internal',
      });
    }

    return result;
  }

  /**
   * Load patient context with read-through caching.
   * First checks the local PmsPatientCache, then falls back to DB.
   */
  async loadPatientContext(patientId: string): Promise<PatientContext | null> {
    // Try read-through cache first
    const cached = await this.readCache(patientId);
    if (cached) {
      this.logger.debug(`Cache hit for patient ${patientId}`);

      await this.auditService.log({
        action: 'PMS_CONTEXT_CACHE_HIT',
        actorId: 'system',
        actorRole: 'SYSTEM',
        resourceType: 'patient_context',
        resourceId: patientId,
        details: { source: 'cache' },
        ipAddress: 'internal',
      });

      return cached as unknown as PatientContext;
    }

    this.logger.debug(`Cache miss for patient ${patientId} — loading from database`);

    // Fall through to database (soft-deleted patients are excluded — a
    // removed patient must never be synced to a PMS)
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, isDeleted: false },
    });

    if (!patient) {
      this.logger.warn(`Patient ${patientId} not found for context loading`);
      return null;
    }

    const context: PatientContext = {
      patientId: patient.id,
      demographics: {
        id: patient.id,
        name: patient.name,
        dob: patient.dob.toISOString().split('T')[0] ?? '',
        mobile: patient.mobile,
      },
      visitHistory: [],
      chronicConditions: [],
      currentMedications: [],
      upcomingAppointment: null,
      riskFlags: [],
    };

    // Write-through: persist loaded context to cache
    await this.writeCache(patientId, context as unknown as Record<string, unknown>);

    await this.auditService.log({
      action: 'PMS_CONTEXT_LOADED',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'patient_context',
      resourceId: patientId,
      details: { source: 'database' },
      ipAddress: 'internal',
    });

    return context;
  }

  /**
   * Get the last sync metadata for a patient.
   */
  async getLastSyncInfo(
    patientId: string,
  ): Promise<{ lastSyncedAt: string | null; targetSystem?: string; externalId?: string }> {
    try {
      const cached = await this.prisma.pmsPatientCache.findUnique({
        where: { patientId },
      });
      if (!cached) return { lastSyncedAt: null };

      const syncMeta = (cached.data as Record<string, unknown>)?.syncMeta as
        | Record<string, unknown>
        | undefined;
      return {
        lastSyncedAt: cached.lastSyncedAt.toISOString(),
        targetSystem: syncMeta?.targetSystem as string | undefined,
        externalId: syncMeta?.externalId as string | undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to read sync info: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return { lastSyncedAt: null };
    }
  }

  // ─── Cache Methods ─────────────────────────────────────────────

  /**
   * Read from the PmsPatientCache, checking TTL freshness.
   */
  private async readCache(patientId: string): Promise<Record<string, unknown> | null> {
    try {
      const cached = await this.prisma.pmsPatientCache.findUnique({
        where: { patientId },
      });

      if (!cached) return null;

      // Check TTL expiry
      const age = Date.now() - new Date(cached.lastSyncedAt).getTime();
      if (age > this.cacheTtlMs) {
        this.logger.debug(
          `Cache stale for patient ${patientId} (age: ${Math.round(age / 1000 / 60)}min, TTL: ${Math.round(this.cacheTtlMs / 1000 / 60)}min)`,
        );
        return null;
      }

      return cached.data as Record<string, unknown>;
    } catch (error) {
      this.logger.error(
        `Cache read failed for patient ${patientId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null; // Fail open — don't block the primary operation
    }
  }

  /**
   * Write to the PmsPatientCache (upsert).
   */
  private async writeCache(patientId: string, data: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma.pmsPatientCache.upsert({
        where: { patientId },
        create: {
          patientId,
          data: data as unknown as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
        },
        update: {
          data: data as unknown as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
        },
      });
      this.logger.debug(`Cache updated for patient ${patientId}`);
    } catch (error) {
      this.logger.error(
        `Cache write failed for patient ${patientId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Fail open — don't block the primary operation
    }
  }

  /**
   * Update the sync metadata cache for a patient.
   */
  private async updateSyncCache(
    patientId: string,
    syncMeta: {
      lastSyncedAt: string;
      targetSystem: string;
      externalId?: string;
      durationMs?: number;
    },
  ): Promise<void> {
    try {
      await this.prisma.pmsPatientCache.upsert({
        where: { patientId },
        create: {
          patientId,
          data: { syncMeta } as unknown as Prisma.InputJsonValue,
          lastSyncedAt: new Date(syncMeta.lastSyncedAt),
        },
        update: {
          data: { syncMeta } as unknown as Prisma.InputJsonValue,
          lastSyncedAt: new Date(syncMeta.lastSyncedAt),
        },
      });
      this.logger.log(`Sync metadata cached for patient ${patientId} → ${syncMeta.targetSystem}`);
    } catch (error) {
      this.logger.error(
        `Sync metadata cache failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
