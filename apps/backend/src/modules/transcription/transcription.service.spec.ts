import { TranscriptionService } from './transcription.service';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';

const mockPrisma = {
  sessionTranscript: {
    create: jest.fn().mockResolvedValue({}),
  },
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockFetch = jest.fn();
const configValues: Record<string, string> = {};

function createService(): TranscriptionService {
  return new TranscriptionService(
    mockPrisma as unknown as PrismaService,
    {
      get: jest.fn((key: string, fallback?: string) => configValues[key] ?? fallback),
    } as unknown as ConfigService,
    mockAudit as unknown as AuditService,
  );
}

function mockWhisperResponse(text: string) {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: jest.fn().mockResolvedValue({ text }),
    text: jest.fn().mockResolvedValue(text),
  });
}

/** Extract the FormData body that was passed to fetch. */
function sentFormData(): FormData {
  const body = mockFetch.mock.calls[0][1].body as FormData;
  return body;
}

describe('TranscriptionService', () => {
  const audio = Buffer.from('fake-webm-audio-bytes');

  beforeEach(() => {
    jest.clearAllMocks();
    configValues['openai.whisperApiUrl'] = 'http://whisper:9001/inference';
    configValues['openai.apiKey'] = '';
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterAll(() => {
    delete (global as unknown as Record<string, unknown>).fetch;
  });

  describe('whisper.cpp path (no OpenAI key)', () => {
    it('sends the selected language as a multipart form field', async () => {
      mockWhisperResponse('hello');
      const service = createService();

      const result = await service.transcribeBuffer(audio, 's1', 'hi');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://whisper:9001/inference',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(sentFormData().get('language')).toBe('hi');
      expect(sentFormData().get('file')).toBeInstanceOf(Blob);
      expect(result).toEqual({ text: 'hello', isFinal: true });
      expect(mockPrisma.sessionTranscript.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sessionId: 's1', text: 'hello' }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TRANSCRIPTION_BUFFER_COMPLETED' }),
      );
    });

    it('omits language when none is selected (server auto-detects)', async () => {
      mockWhisperResponse('ok');
      const service = createService();

      await service.transcribeBuffer(audio, 's1');

      expect(sentFormData().get('language')).toBeNull();
    });

    it('normalizes the locale to lowercase ISO 639-1', async () => {
      mockWhisperResponse('ok');
      const service = createService();

      await service.transcribeBuffer(audio, 's1', 'HI');
      expect(sentFormData().get('language')).toBe('hi');
    });

    it('drops unrecognized language values so auto-detect applies', async () => {
      mockWhisperResponse('ok');
      const service = createService();

      await service.transcribeBuffer(audio, 's1', 'english');
      expect(sentFormData().get('language')).toBeNull();
    });

    it('throws and audits TRANSCRIPTION_FAILED when whisper is down', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      const service = createService();

      await expect(service.transcribeBuffer(audio, 's1', 'hi')).rejects.toThrow('ECONNREFUSED');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TRANSCRIPTION_FAILED',
          details: expect.objectContaining({ error: 'ECONNREFUSED' }),
        }),
      );
    });
  });

  describe('OpenAI Whisper path (API key configured)', () => {
    beforeEach(() => {
      configValues['openai.apiKey'] = 'sk-test';
    });

    it('forwards the selected language to the OpenAI API', async () => {
      mockWhisperResponse('hola');
      const service = createService();

      await service.transcribeBuffer(audio, 's1', 'es');

      expect(sentFormData().get('model')).toBe('whisper-1');
      expect(sentFormData().get('language')).toBe('es');
    });

    it('no longer hardcodes English when no language is selected', async () => {
      mockWhisperResponse('auto');
      const service = createService();

      await service.transcribeBuffer(audio, 's1');

      expect(sentFormData().get('language')).toBeNull();
    });
  });
});
