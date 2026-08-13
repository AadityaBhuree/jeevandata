import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../opentelemetry/metrics.service';
import { getClinicFilter, type ClinicScopeUser } from '../../common/utils/clinic-scope';
import { SessionStatus, type SessionStatus as SessionStatusType } from '@jeevandata/shared-types';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly metrics: MetricsService,
  ) {}

  async getLatestBrief(patientId: string) {
    const record = await this.prisma.intakeRecord.findFirst({
      where: { patientId },
      orderBy: { generatedAt: 'desc' },
      include: {
        session: {
          select: {
            id: true,
            startedAt: true,
            status: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`No intake records found for patient ${patientId}`);
    }

    await this.auditService.log({
      action: 'DASHBOARD_BRIEF_VIEW',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'intake_record',
      resourceId: record.id,
      details: { patientId, sessionId: record.sessionId },
      ipAddress: 'internal',
    });

    return {
      id: record.id,
      sessionId: record.sessionId,
      patientId: record.patientId,
      brief: record.brief,
      intakeData: record.intakeData,
      session: record.session,
      generatedAt: record.generatedAt,
    };
  }

  async getActiveSessions(page: number, limit: number, user?: ClinicScopeUser) {
    const clinicFilter = getClinicFilter(user);
    const statusFilter: { status: { notIn: SessionStatusType[] } } = {
      status: {
        notIn: [SessionStatus.COMPLETED, SessionStatus.FAILED, SessionStatus.TIMED_OUT],
      },
    };
    const [sessions, total] = await Promise.all([
      this.prisma.intakeSession.findMany({
        where: {
          ...clinicFilter,
          ...statusFilter,
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              dob: true,
            },
          },
        },
      }),
      this.prisma.intakeSession.count({
        where: {
          ...clinicFilter,
          ...statusFilter,
        },
      }),
    ]);

    await this.auditService.log({
      action: 'DASHBOARD_ACTIVE_SESSIONS_VIEW',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'dashboard',
      resourceId: 'active-sessions',
      details: { sessionCount: sessions.length, total, page, limit },
      ipAddress: 'internal',
    });

    return {
      data: sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRecentBriefs(page: number, limit: number, user?: ClinicScopeUser) {
    const clinicFilter = getClinicFilter(user);
    const briefWhere = {
      // IntakeRecord has no clinicId column — scope via its session relation
      ...(clinicFilter.clinicId ? { session: { clinicId: clinicFilter.clinicId } } : {}),
    };
    const [records, total] = await Promise.all([
      this.prisma.intakeRecord.findMany({
        where: briefWhere,
        orderBy: { generatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          session: {
            select: {
              id: true,
              startedAt: true,
              status: true,
            },
          },
          patient: {
            select: {
              id: true,
              name: true,
              dob: true,
            },
          },
        },
      }),
      this.prisma.intakeRecord.count({ where: briefWhere }),
    ]);

    await this.auditService.log({
      action: 'DASHBOARD_RECENT_BRIEFS_VIEW',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'dashboard',
      resourceId: 'recent-briefs',
      details: { briefCount: records.length, total, page, limit },
      ipAddress: 'internal',
    });

    return {
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markBriefReviewed(briefId: string) {
    const record = await this.prisma.intakeRecord.findUnique({
      where: { id: briefId },
    });

    if (!record) {
      throw new NotFoundException(`Brief ${briefId} not found`);
    }

    // Update the session status to COMPLETED (this path bypasses
    // SessionService.updateStatus, so count the completion here for the
    // session-timeout-rate alert denominator).
    await this.prisma.intakeSession.update({
      where: { id: record.sessionId },
      data: { status: 'COMPLETED' },
    });
    this.metrics.incrementSessionsCompleted();

    this.logger.log(`Brief ${briefId} reviewed, session ${record.sessionId} completed`);

    await this.auditService.log({
      action: 'DASHBOARD_BRIEF_REVIEWED',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'intake_record',
      resourceId: briefId,
      details: { sessionId: record.sessionId, patientId: record.patientId },
      ipAddress: 'internal',
    });

    return { success: true, message: 'Brief marked as reviewed' };
  }

  async getPatientHistory(patientId: string, page: number, limit: number, user?: ClinicScopeUser) {
    const clinicFilter = getClinicFilter(user);
    const historyWhere = {
      patientId,
      ...(clinicFilter.clinicId ? { session: { clinicId: clinicFilter.clinicId } } : {}),
    };
    const [records, total] = await Promise.all([
      this.prisma.intakeRecord.findMany({
        where: historyWhere,
        orderBy: { generatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          session: {
            select: {
              id: true,
              startedAt: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.intakeRecord.count({
        where: historyWhere,
      }),
    ]);

    await this.auditService.log({
      action: 'DASHBOARD_PATIENT_HISTORY_VIEW',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'patient',
      resourceId: patientId,
      details: { recordCount: records.length, total, page, limit },
      ipAddress: 'internal',
    });

    return {
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
