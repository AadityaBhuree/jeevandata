import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── In-memory Dexie fake (jsdom has no indexedDB) ─────────────
// Everything lives inside vi.hoisted so the mock factory can see it.

const { tables, tableFor } = vi.hoisted(() => {
  interface FakeRecord {
    id?: unknown;
    [key: string]: unknown;
  }

  /**
   * Minimal Dexie-compatible table. `primaryKey` mirrors the first field of
   * each `stores()` schema entry (e.g. `sessionId` for transcripts, `++id`
   * auto-increment for mutations/syncLog).
   */
  class FakeTable {
    store = new Map<unknown, FakeRecord>();
    autoIncrement = 1;

    constructor(
      public name: string,
      _schema: string,
      private primaryKey: string = 'id',
    ) {}

    async put(record: FakeRecord): Promise<unknown> {
      let key = record[this.primaryKey];
      if (key === undefined) {
        key = this.autoIncrement++;
        record[this.primaryKey] = key;
      }
      this.store.set(key, { ...record });
      return key;
    }

    async add(record: FakeRecord): Promise<unknown> {
      return this.put(record);
    }

    async get(key: unknown): Promise<FakeRecord | undefined> {
      const found = this.store.get(key);
      return found ? { ...found } : undefined;
    }

    async update(key: unknown, changes: Partial<FakeRecord>): Promise<number> {
      const existing = this.store.get(key);
      if (!existing) return 0;
      this.store.set(key, { ...existing, ...changes });
      return 1;
    }

    async delete(key: unknown): Promise<void> {
      this.store.delete(key);
    }

    async toArray(): Promise<FakeRecord[]> {
      return Array.from(this.store.values()).map((r) => ({ ...r }));
    }

    async count(): Promise<number> {
      return this.store.size;
    }

    filter = (pred: (r: FakeRecord) => boolean) => ({
      toArray: async () =>
        Array.from(this.store.values())
          .filter((r) => pred({ ...r }))
          .map((r) => ({ ...r })),
    });

    where = (index: string) => ({
      equals: (value: unknown) => ({
        toArray: async () =>
          Array.from(this.store.values())
            .filter((r) => r[index] === value)
            .map((r) => ({ ...r })),
        count: async () => Array.from(this.store.values()).filter((r) => r[index] === value).length,
        delete: async () => {
          const keys = Array.from(this.store.entries())
            .filter(([, r]) => r[index] === value)
            .map(([k]) => k);
          keys.forEach((k) => this.store.delete(k));
        },
      }),
      notEqual: (value: unknown) => ({
        toArray: async () =>
          Array.from(this.store.values())
            .filter((r) => r[index] !== value)
            .map((r) => ({ ...r })),
      }),
    });

    orderBy = (_key: string) => ({
      reverse: () => ({
        toArray: async () =>
          Array.from(this.store.values())
            .map((r) => ({ ...r }))
            .reverse(),
      }),
      toArray: async () => Array.from(this.store.values()).map((r) => ({ ...r })),
    });
  }

  const tables = new Map<string, FakeTable>();

  function tableFor(name: string, primaryKey = 'id'): FakeTable {
    let table = tables.get(name);
    if (!table) {
      table = new FakeTable(name, '', primaryKey);
      tables.set(name, table);
    }
    return table;
  }

  return { FakeTable, tables, tableFor };
});

vi.mock('dexie', () => {
  return {
    __esModule: true,
    default: class MockDexie {
      version() {
        return {
          stores: (_schemaMap: Record<string, string>) => {
            // Mirrors real Dexie: the subclass declares `patients!: Table`
            // fields, which TypeScript turns into `Object.defineProperty(this,
            // 'patients', { value: undefined })` that shadows prototype
            // getters. Real Dexie assigns each table to `this[name]` inside
            // stores(), so we do the same.
            const primaryKeys: Record<string, string> = {
              patients: 'id',
              sessions: 'id',
              transcripts: 'sessionId',
              briefs: 'sessionId',
              mutations: 'id',
              syncLog: 'id',
            };
            for (const name of Object.keys(_schemaMap)) {
              (this as Record<string, unknown>)[name] = tableFor(name, primaryKeys[name]);
            }
            // Real Dexie's version().stores() returns a Version handle with
            // .upgrade(cb) — make it chainable. The upgrade callback is a
            // no-op here (tests seed fresh in-memory tables).
            return { upgrade: () => this };
          },
        };
      }
    },
  };
});

// Import AFTER the mock is registered (hoisted)
import {
  cachePatient,
  getCachedPatient,
  searchCachedPatients,
  cacheSession,
  getPendingSessions,
  cacheTranscripts,
  getCachedTranscripts,
  cacheBrief,
  getCachedBrief,
  enqueueMutation,
  getPendingMutations,
  getPendingMutationCount,
  markMutationSynced,
  logSyncEntry,
  getSyncLogs,
  clearSyncedMutations,
} from '../db';

describe('IndexedDB helpers (in-memory Dexie)', () => {
  beforeEach(() => {
    tables.forEach((t) => {
      t.store.clear();
      t.autoIncrement = 1;
    });
  });

  // ─── Patients ──────────────────────────────────────────────

  describe('patient cache', () => {
    it('should cache and retrieve a patient (PII decrypted on read)', async () => {
      await cachePatient({
        id: 'p1',
        name: 'Priya',
        dob: '1990-01-01',
        mobile: '+919999999999',
        lastSyncedAt: '2026-08-05T00:00:00Z',
        data: { allergies: ['penicillin'] },
      });

      const cached = await getCachedPatient('p1');
      expect(cached?.name).toBe('Priya');
      expect(cached?.data).toEqual({ allergies: ['penicillin'] });
    });

    it('should store patient PII encrypted at rest (no plaintext name/mobile)', async () => {
      await cachePatient({
        id: 'p1',
        name: 'Priya Sharma',
        dob: '1990-01-01',
        mobile: '+919999999999',
        lastSyncedAt: '2026-08-05T00:00:00Z',
        data: {},
      });

      const raw = tables.get('patients')!.store.get('p1') as Record<string, unknown>;
      expect(raw).toBeDefined();
      // The encrypted envelope must be present…
      expect(typeof raw.enc).toBe('string');
      // …and no plaintext PII may live on the row.
      expect(raw.name).toBeUndefined();
      expect(raw.mobile).toBeUndefined();
      expect(JSON.stringify(raw)).not.toContain('Priya');
      expect(JSON.stringify(raw)).not.toContain('+919999999999');
    });

    it('should search patients by name (case-insensitive)', async () => {
      await cachePatient({
        id: 'p1',
        name: 'Priya Sharma',
        dob: '',
        mobile: '+911111111111',
        lastSyncedAt: '',
        data: {},
      });

      const results = await searchCachedPatients('priya');
      expect(results).toHaveLength(1);
    });

    it('should search patients by mobile', async () => {
      await cachePatient({
        id: 'p1',
        name: 'Rahul',
        dob: '',
        mobile: '+919876543210',
        lastSyncedAt: '',
        data: {},
      });

      const results = await searchCachedPatients('9876543210');
      expect(results).toHaveLength(1);
    });
  });

  // ─── Sessions ──────────────────────────────────────────────

  describe('session cache', () => {
    it('should cache and list pending sessions (localData encrypted at rest)', async () => {
      await cacheSession({
        id: 's1',
        patientId: 'p1',
        status: 'INTAKE_IN_PROGRESS',
        startedAt: '2026-08-05T00:00:00Z',
        localData: { language: 'hi' },
      });
      await cacheSession({
        id: 's2',
        patientId: 'p1',
        status: 'COMPLETED',
        startedAt: '2026-08-04T00:00:00Z',
        localData: {},
      });

      const pending = await getPendingSessions();
      expect(pending.map((s) => s.id)).toEqual(['s1']);
      expect(pending[0]!.localData).toEqual({ language: 'hi' });

      const raw = tables.get('sessions')!.store.get('s1') as Record<string, unknown>;
      expect(typeof raw.localDataEnc).toBe('string');
      expect(JSON.stringify(raw)).not.toContain('"language"');
    });
  });

  // ─── Transcripts ───────────────────────────────────────────

  describe('transcript cache', () => {
    it('should cache transcripts and dedupe on re-cache', async () => {
      const first = [{ speaker: 'ai', text: 'Hello', timestamp: 100 }];
      await cacheTranscripts('s1', first);

      const merged = await cacheTranscripts('s1', [
        { speaker: 'ai', text: 'Hello', timestamp: 100 },
        { speaker: 'patient', text: 'Hi', timestamp: 200 },
      ]);

      expect(merged).toHaveLength(2);
      const cached = await getCachedTranscripts('s1');
      expect(cached?.entries).toHaveLength(2);
    });

    it('should sort merged transcripts by timestamp', async () => {
      await cacheTranscripts('s1', [{ speaker: 'ai', text: 'Later', timestamp: 300 }]);
      await cacheTranscripts('s1', [{ speaker: 'patient', text: 'Earlier', timestamp: 100 }]);

      const cached = await getCachedTranscripts('s1');
      expect(cached?.entries.map((e) => e.timestamp)).toEqual([100, 300]);
    });

    it('should store transcript text encrypted at rest', async () => {
      await cacheTranscripts('s1', [
        { speaker: 'patient', text: 'I have chest pain', timestamp: 100 },
      ]);

      const raw = tables.get('transcripts')!.store.get('s1') as Record<string, unknown>;
      expect(typeof raw.enc).toBe('string');
      expect(JSON.stringify(raw)).not.toContain('chest pain');
    });
  });

  // ─── Briefs ────────────────────────────────────────────────

  describe('brief cache', () => {
    it('should cache and retrieve a brief per session (encrypted at rest)', async () => {
      await cacheBrief('s1', { summary: 'Fever, vitals stable' });

      const cached = await getCachedBrief('s1');
      expect(cached?.brief.summary).toBe('Fever, vitals stable');

      const raw = tables.get('briefs')!.store.get('s1') as Record<string, unknown>;
      expect(typeof raw.enc).toBe('string');
      expect(JSON.stringify(raw)).not.toContain('Fever');
    });
  });

  // ─── Outbox ────────────────────────────────────────────────

  describe('outbox mutation queue', () => {
    it('should enqueue a pending mutation', async () => {
      const id = await enqueueMutation('COMPLETE_SESSION', { sessionId: 's1' });
      expect(id).toBeDefined();

      const pending = await getPendingMutations();
      expect(pending).toHaveLength(1);
      expect(pending[0]!.type).toBe('COMPLETE_SESSION');
      expect(pending[0]!.status).toBe('pending');
    });

    it('should count pending mutations', async () => {
      await enqueueMutation('COMPLETE_SESSION', { sessionId: 's1' });
      await enqueueMutation('REGISTER_PATIENT', { name: 'R' });

      expect(await getPendingMutationCount()).toBe(2);
    });

    it('should order mutations oldest-first (clientTimestamp asc)', async () => {
      await enqueueMutation('COMPLETE_SESSION', { sessionId: 'new' });
      await enqueueMutation('COMPLETE_SESSION', { sessionId: 'old' });

      const pending = await getPendingMutations();
      expect(pending).toHaveLength(2);
      // Same clientTimestamp here (same ms) — oldest-first means id asc
      expect(pending[0]!.payload.sessionId).toBe('new');
    });

    it('should store mutation payloads encrypted at rest (no plaintext PHI)', async () => {
      const sensitive = {
        sessionId: 's-secret-1',
        intakeData: {
          chiefComplaint: 'High fever and severe headache',
          patientNotes: 'Patient is diabetic',
        },
      };
      await enqueueMutation('COMPLETE_SESSION', sensitive);

      const rows = Array.from(tables.get('mutations')!.store.values()) as Array<
        Record<string, unknown>
      >;
      const raw = rows[0]!;
      expect(typeof raw.payloadEnc).toBe('string');
      // No plaintext payload on the row…
      expect(raw.payload).toBeUndefined();
      // …and the raw serialization must not contain any PHI substrings.
      const serialized = JSON.stringify(raw);
      expect(serialized).not.toContain('High fever');
      expect(serialized).not.toContain('diabetic');
      expect(serialized).not.toContain('s-secret-1');
    });

    it('should decrypt the payload when reading pending mutations', async () => {
      await enqueueMutation('COMPLETE_SESSION', {
        sessionId: 's1',
        intakeData: { chiefComplaint: 'Fever' },
      });

      const pending = await getPendingMutations();
      expect(pending[0]!.payload).toEqual({
        sessionId: 's1',
        intakeData: { chiefComplaint: 'Fever' },
      });
    });

    it('should isolate a corrupt payload so it cannot brick healthy mutations', async () => {
      // Healthy mutation first.
      const healthyId = await enqueueMutation('COMPLETE_SESSION', {
        sessionId: 's1',
        intakeData: { chiefComplaint: 'Fever' },
      });
      // Manually inject a corrupt encrypted payload (tampered ciphertext).
      const corruptId = await enqueueMutation('COMPLETE_SESSION', {
        sessionId: 's2',
        intakeData: { chiefComplaint: 'Cough' },
      });
      const mutationsTable = tables.get('mutations')!;
      const corruptRow = mutationsTable.store.get(corruptId) as { payloadEnc: string };
      corruptRow.payloadEnc = `${corruptRow.payloadEnc.split('.')[0]}.Zm9vYmFy`; // garbage ciphertext

      // getPendingMutations must skip the corrupt row (marking it failed + log)
      // and still return the healthy one.
      const pending = await getPendingMutations();
      expect(pending.map((m) => m.id)).toEqual([healthyId]);
      expect(pending[0]!.payload.sessionId).toBe('s1');

      // The corrupt row was terminated so it never retries forever.
      const after = mutationsTable.store.get(corruptId) as { status: string; attempts: number };
      expect(after.status).toBe('failed');
      expect(after.attempts).toBeGreaterThan(0);

      // And a DECRYPT_FAILED audit entry was logged (PHI-free).
      const logs = await getSyncLogs();
      const entry = logs.find((l) => l.action === 'DECRYPT_FAILED');
      expect(entry).toBeDefined();
      expect(entry!.entityId).toBe(`mutation-${corruptId}`);
    });
  });

  // ─── Sync log ──────────────────────────────────────────────

  describe('sync log', () => {
    it('should append sync entries and return them newest-first', async () => {
      await logSyncEntry({
        entityId: 's1',
        entityType: 'COMPLETE_SESSION',
        action: 'REPLAYED',
        clientTimestamp: '2026-08-05T09:00:00Z',
        status: 'synced',
      });
      await logSyncEntry({
        entityId: 's2',
        entityType: 'COMPLETE_SESSION',
        action: 'REPLAYED',
        clientTimestamp: '2026-08-05T10:00:00Z',
        status: 'failed',
        note: 'boom',
      });

      const logs = await getSyncLogs();
      expect(logs).toHaveLength(2);
      // Newest first (reverse id order)
      expect(logs[0]!.entityId).toBe('s2');
      expect(logs[0]!.status).toBe('failed');
    });
  });

  describe('clearSyncedMutations', () => {
    it('should remove synced mutations but keep pending ones', async () => {
      const id = await enqueueMutation('COMPLETE_SESSION', { sessionId: 's1' });
      await markMutationSynced(id as number);
      await enqueueMutation('COMPLETE_SESSION', { sessionId: 's2' });

      await clearSyncedMutations();

      const pending = await getPendingMutations();
      expect(pending).toHaveLength(1);
      expect(pending[0]!.payload.sessionId).toBe('s2');
    });
  });
});
