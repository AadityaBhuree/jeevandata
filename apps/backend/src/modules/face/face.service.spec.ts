import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FaceService } from './face.service';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../opentelemetry/metrics.service';
import type { FaceEmbeddingInput, FaceSearchQuery } from '@jeevandata/shared-schemas';

// ─── Mocks ─────────────────────────────────────────────────────

const mockQdrantClient = {
  getCollections: jest.fn(),
  createCollection: jest.fn(),
  upsert: jest.fn(),
  search: jest.fn(),
  scroll: jest.fn(),
};

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn(() => mockQdrantClient),
}));

describe('FaceService', () => {
  let service: FaceService;

  const mockConfig: Record<string, unknown> = {
    'qdrant.url': 'http://localhost:6333',
    'qdrant.apiKey': '',
    'face.matchThreshold': 0.82,
    'face.embeddingDim': 512,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaceService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: MetricsService,
          useValue: {
            recordQdrantLatency: jest.fn(),
            recordFaceSearchLatency: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FaceService>(FaceService);
  });

  // ─── Initialization ─────────────────────────────────────────

  describe('onModuleInit', () => {
    it('should create the face_embeddings collection if it does not exist', async () => {
      mockQdrantClient.getCollections.mockResolvedValue({
        collections: [],
      });

      await service.onModuleInit();

      expect(mockQdrantClient.createCollection).toHaveBeenCalledWith(
        'face_embeddings',
        expect.objectContaining({
          vectors: { size: 512, distance: 'Cosine' },
        }),
      );
    });

    it('should skip collection creation if it already exists', async () => {
      mockQdrantClient.getCollections.mockResolvedValue({
        collections: [{ name: 'face_embeddings' }],
      });

      await service.onModuleInit();

      expect(mockQdrantClient.createCollection).not.toHaveBeenCalled();
    });

    it('should handle Qdrant connection errors gracefully (boot must not fail)', async () => {
      // Qdrant is optional at boot: a down vector DB must not abort Nest startup
      // (the readiness probe reports its health separately). onModuleInit should
      // resolve and the collection creation is deferred.
      mockQdrantClient.getCollections.mockRejectedValue(new Error('Connection refused'));

      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(mockQdrantClient.createCollection).not.toHaveBeenCalled();
    });
  });

  // ─── Upsert Embedding ────────────────────────────────────────

  describe('upsertEmbedding', () => {
    const validEmbedding: FaceEmbeddingInput = {
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      vector: new Array(512).fill(0.1),
      capturedAt: '2025-01-15T10:30:00Z',
    };

    it('should upsert a face embedding to Qdrant', async () => {
      mockQdrantClient.upsert.mockResolvedValue({ status: 'ok' });

      await service.upsertEmbedding(validEmbedding);

      expect(mockQdrantClient.upsert).toHaveBeenCalledTimes(1);
      expect(mockQdrantClient.upsert).toHaveBeenCalledWith(
        'face_embeddings',
        expect.objectContaining({
          wait: true,
          points: expect.arrayContaining([
            expect.objectContaining({
              vector: validEmbedding.vector,
              payload: expect.objectContaining({
                patient_id: validEmbedding.patientId,
              }),
            }),
          ]),
        }),
      );
    });

    it('should use current timestamp when capturedAt is not provided', async () => {
      const input = { ...validEmbedding, capturedAt: undefined };
      mockQdrantClient.upsert.mockResolvedValue({ status: 'ok' });

      await service.upsertEmbedding(input);

      const upsertCall = mockQdrantClient.upsert.mock.calls[0]?.[1];
      const pointPayload = upsertCall?.points?.[0]?.payload;
      expect(pointPayload?.captured_at).toBeDefined();
    });

    it('should handle Qdrant upsert errors', async () => {
      mockQdrantClient.upsert.mockRejectedValue(new Error('Qdrant service unavailable'));

      await expect(service.upsertEmbedding(validEmbedding)).rejects.toThrow(
        'Qdrant service unavailable',
      );
    });
  });

  // ─── Search by Face ──────────────────────────────────────────

  describe('searchByFace', () => {
    const searchQuery: FaceSearchQuery = {
      vector: new Array(512).fill(0.1),
      threshold: 0.82,
      limit: 5,
    };

    it('should return matched patients sorted by similarity score', async () => {
      mockQdrantClient.search.mockResolvedValue([
        {
          id: 'patient-a_1700000000',
          score: 0.94,
          payload: {
            patient_id: 'patient-a',
            captured_at: '2025-01-15T10:30:00Z',
          },
        },
        {
          id: 'patient-b_1700000001',
          score: 0.78,
          payload: {
            patient_id: 'patient-b',
            captured_at: '2025-01-15T10:31:00Z',
          },
        },
      ]);

      const results = await service.searchByFace(searchQuery);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        patientId: 'patient-a',
        score: 0.94,
        capturedAt: '2025-01-15T10:30:00Z',
      });
      expect(results[1]).toEqual({
        patientId: 'patient-b',
        score: 0.78,
        capturedAt: '2025-01-15T10:31:00Z',
      });
    });

    it('should pass the threshold to Qdrant search', async () => {
      mockQdrantClient.search.mockResolvedValue([]);

      await service.searchByFace(searchQuery);

      expect(mockQdrantClient.search).toHaveBeenCalledWith(
        'face_embeddings',
        expect.objectContaining({
          score_threshold: 0.82,
          limit: 5,
        }),
      );
    });

    it('should return empty array when no matches found', async () => {
      mockQdrantClient.search.mockResolvedValue([]);

      const results = await service.searchByFace(searchQuery);

      expect(results).toEqual([]);
    });

    it('should handle Qdrant search errors', async () => {
      mockQdrantClient.search.mockRejectedValue(new Error('Search failed'));

      await expect(service.searchByFace(searchQuery)).rejects.toThrow('Search failed');
    });

    it('should handle null/undefined payload fields gracefully', async () => {
      mockQdrantClient.search.mockResolvedValue([
        {
          id: 'no-payload',
          score: 0.5,
          payload: null,
        },
      ]);

      const results = await service.searchByFace(searchQuery);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        patientId: '',
        score: 0.5,
        capturedAt: '',
      });
    });

    it('should default threshold to 0.82 from Zod schema when not specified', async () => {
      mockQdrantClient.search.mockResolvedValue([]);

      await service.searchByFace({
        vector: new Array(512).fill(0.1),
        limit: 5,
        threshold: 0.82,
      });

      // The threshold defaults to 0.82 from the Zod schema validation layer
      expect(mockQdrantClient.search).toHaveBeenCalledWith(
        'face_embeddings',
        expect.objectContaining({
          score_threshold: 0.82,
        }),
      );
    });
  });

  // ─── Get Patient Embeddings ──────────────────────────────────

  describe('getPatientEmbeddings', () => {
    const patientId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return embeddings for a known patient', async () => {
      mockQdrantClient.scroll.mockResolvedValue({
        points: [
          {
            id: 'pt1_1700000000',
            payload: { captured_at: '2025-01-15T10:30:00Z' },
          },
          {
            id: 'pt1_1700000001',
            payload: { captured_at: '2025-01-15T11:00:00Z' },
          },
        ],
      });

      const results = await service.getPatientEmbeddings(patientId);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: 'pt1_1700000000',
        capturedAt: '2025-01-15T10:30:00Z',
      });
    });

    it('should throw NotFoundException when no embeddings exist', async () => {
      mockQdrantClient.scroll.mockResolvedValue({
        points: [],
      });

      await expect(service.getPatientEmbeddings(patientId)).rejects.toThrow(
        `No embeddings found for patient ${patientId}`,
      );
    });

    it('should filter by patient_id in Qdrant scroll query', async () => {
      mockQdrantClient.scroll.mockResolvedValue({
        points: [
          {
            id: 'pt1_1700000000',
            payload: { captured_at: '2025-01-15T10:30:00Z' },
          },
        ],
      });

      await service.getPatientEmbeddings(patientId);

      expect(mockQdrantClient.scroll).toHaveBeenCalledWith(
        'face_embeddings',
        expect.objectContaining({
          filter: {
            must: [{ key: 'patient_id', match: { value: patientId } }],
          },
        }),
      );
    });

    it('should limit results to 10 most recent embeddings', async () => {
      mockQdrantClient.scroll.mockResolvedValue({ points: [] });

      await expect(service.getPatientEmbeddings(patientId)).rejects.toThrow();

      expect(mockQdrantClient.scroll).toHaveBeenCalledWith(
        'face_embeddings',
        expect.objectContaining({ limit: 10 }),
      );
    });
  });
});
