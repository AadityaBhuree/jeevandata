import { Injectable, Logger, NotFoundException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { QdrantClient } from '@qdrant/js-client-rest';
import type { FaceEmbeddingInput, FaceSearchQuery } from '@jeevandata/shared-schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { AuditService } from '../audit/audit.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime value import
import { MetricsService } from '../opentelemetry/metrics.service';

const FACE_COLLECTION = 'face_embeddings';

@Injectable()
export class FaceService {
  private readonly logger = new Logger(FaceService.name);
  private readonly qdrant: QdrantClient;
  constructor(
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly metrics: MetricsService,
  ) {
    this.qdrant = new QdrantClient({
      url: this.configService.get<string>('qdrant.url')!,
      apiKey: this.configService.get<string>('qdrant.apiKey') ?? undefined,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureCollection();
  }

  private async ensureCollection(): Promise<void> {
    const start = Date.now();
    try {
      const collections = await this.qdrant.getCollections();
      this.metrics.recordQdrantLatency('get_collections', Date.now() - start);
      const exists = collections.collections.some((c) => c.name === FACE_COLLECTION);

      if (!exists) {
        await this.qdrant.createCollection(FACE_COLLECTION, {
          vectors: {
            size: 512,
            distance: 'Cosine',
          },
          optimizers_config: {
            indexing_threshold: 100,
          },
        });
        this.metrics.recordQdrantLatency('create_collection', Date.now() - start);
        this.logger.log(`Created Qdrant collection: ${FACE_COLLECTION}`);
      }
    } catch (error) {
      this.metrics.recordQdrantLatency('get_collections', Date.now() - start);
      // Do NOT rethrow: Qdrant is optional at boot (the readiness probe reports
      // its health separately). Rethrowing here aborts Nest startup when the
      // vector DB is down, taking the whole API down with it. Log and continue.
      this.logger.warn(
        `Qdrant unavailable at boot, deferring collection ensure: ${(error as Error).message}`,
      );
    }
  }

  async upsertEmbedding(data: FaceEmbeddingInput): Promise<void> {
    // Qdrant point IDs must be an unsigned integer or a UUID. The patient id +
    // timestamp hybrid string was rejected with a 400, failing every patient
    // registration with a face embedding. A random UUID keeps the collision-free
    // property; patient_id + captured_at remain in the payload for filtering.
    const pointId = randomUUID();

    const start = Date.now();
    await this.qdrant.upsert(FACE_COLLECTION, {
      wait: true,
      points: [
        {
          id: pointId,
          vector: data.vector,
          payload: {
            patient_id: data.patientId,
            captured_at: data.capturedAt ?? new Date().toISOString(),
          },
        },
      ],
    });
    this.metrics.recordQdrantLatency('upsert', Date.now() - start);

    this.logger.debug(`Upserted face embedding for patient ${data.patientId}`);

    await this.auditService.log({
      action: 'FACE_EMBEDDING_UPSERT',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'face_embedding',
      resourceId: data.patientId,
      details: { patientId: data.patientId, vectorDimension: data.vector.length },
      ipAddress: 'internal',
    });
  }

  async searchByFace(
    query: FaceSearchQuery,
  ): Promise<Array<{ patientId: string; score: number; capturedAt: string }>> {
    const start = Date.now();
    const searchResult = await this.qdrant.search(FACE_COLLECTION, {
      vector: query.vector,
      limit: query.limit,
      score_threshold: query.threshold,
      with_payload: true,
    });
    const durationMs = Date.now() - start;
    this.metrics.recordQdrantLatency('search', durationMs);
    this.metrics.recordFaceSearchLatency('search', durationMs);

    this.logger.debug(`Face search returned ${searchResult.length} results`);

    await this.auditService.log({
      action: 'FACE_SEARCH',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'face_embedding',
      resourceId: FACE_COLLECTION,
      details: { resultCount: searchResult.length, threshold: query.threshold },
      ipAddress: 'internal',
    });

    return searchResult.map((hit) => ({
      patientId: (hit.payload?.patient_id as string) ?? '',
      score: hit.score ?? 0,
      capturedAt: (hit.payload?.captured_at as string) ?? '',
    }));
  }

  async getPatientEmbeddings(
    patientId: string,
  ): Promise<Array<{ id: string; capturedAt: string }>> {
    const start = Date.now();
    const result = await this.qdrant.scroll(FACE_COLLECTION, {
      filter: {
        must: [
          {
            key: 'patient_id',
            match: { value: patientId },
          },
        ],
      },
      limit: 10,
      with_payload: true,
      with_vector: false,
    });
    this.metrics.recordQdrantLatency('scroll', Date.now() - start);

    if (!result.points || result.points.length === 0) {
      throw new NotFoundException(`No embeddings found for patient ${patientId}`);
    }

    await this.auditService.log({
      action: 'FACE_EMBEDDINGS_READ',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'face_embedding',
      resourceId: patientId,
      details: { embeddingCount: result.points.length },
      ipAddress: 'internal',
    });

    return result.points.map((point) => ({
      id: String(point.id),
      capturedAt: (point.payload?.captured_at as string) ?? '',
    }));
  }
}
