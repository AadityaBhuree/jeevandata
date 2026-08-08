import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly whisperApiUrl: string;
  private readonly openaiApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.whisperApiUrl = this.configService.get<string>(
      'openai.whisperApiUrl',
      'http://localhost:9001/inference',
    );
    this.openaiApiKey = this.configService.get<string>('openai.apiKey', '');
  }

  async transcribe(data: { audioUrl: string; sessionId: string }) {
    this.logger.debug(`Transcribing audio for session ${data.sessionId}: ${data.audioUrl}`);

    // In production, this fetches audio from R2 and sends to Whisper
    // For development, returns a placeholder
    const text = '[Transcription placeholder - Whisper integration pending]';

    await this.prisma.sessionTranscript.create({
      data: {
        sessionId: data.sessionId,
        speaker: 'patient',
        text,
        timestampMs: Date.now(),
      },
    });

    await this.auditService.log({
      action: 'TRANSCRIPTION_CREATED',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'session_transcript',
      resourceId: data.sessionId,
      details: { audioUrl: data.audioUrl, isPlaceholder: true },
      ipAddress: 'internal',
    });

    return { sessionId: data.sessionId, text, isFinal: true };
  }

  /**
   * Transcribe an audio buffer by sending it to the Whisper API.
   * Supports both OpenAI Whisper API and whisper.cpp local server.
   */
  async transcribeBuffer(
    audioBuffer: Buffer,
    sessionId: string,
    language?: string,
  ): Promise<{ text: string; isFinal: boolean }> {
    try {
      const text = await this.callWhisperApi(audioBuffer, this.normalizeLanguage(language));

      // Persist the transcribed text
      await this.prisma.sessionTranscript.create({
        data: {
          sessionId,
          speaker: 'patient',
          text,
          timestampMs: BigInt(Date.now()),
        },
      });

      await this.auditService.log({
        action: 'TRANSCRIPTION_BUFFER_COMPLETED',
        actorId: 'system',
        actorRole: 'SYSTEM',
        resourceType: 'session_transcript',
        resourceId: sessionId,
        details: { audioSizeBytes: audioBuffer.length, textLength: text.length },
        ipAddress: 'internal',
      });

      return { text, isFinal: true };
    } catch (error) {
      this.logger.error(`Whisper transcription failed for session ${sessionId}`, error);

      await this.auditService.log({
        action: 'TRANSCRIPTION_FAILED',
        actorId: 'system',
        actorRole: 'SYSTEM',
        resourceType: 'session_transcript',
        resourceId: sessionId,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          audioSizeBytes: audioBuffer.length,
        },
        ipAddress: 'internal',
      });

      throw error;
    }
  }

  /**
   * Normalize a UI locale into a whisper language code (ISO 639-1).
   * Returns undefined for absent or unrecognized values so the STT server
   * falls back to auto-detection.
   */
  private normalizeLanguage(language?: string): string | undefined {
    if (!language) return undefined;
    const code = language.trim().toLowerCase();
    return /^[a-z]{2}$/.test(code) ? code : undefined;
  }

  private async callWhisperApi(audioBuffer: Buffer, language?: string): Promise<string> {
    // If OpenAI API key is configured, use OpenAI Whisper API
    if (this.openaiApiKey) {
      return this.callOpenAiWhisper(audioBuffer, language);
    }

    // Otherwise, try whisper.cpp local server
    return this.callWhisperCpp(audioBuffer, language);
  }

  private async callOpenAiWhisper(audioBuffer: Buffer, language?: string): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' });
    formData.append('file', blob, 'recording.webm');
    formData.append('model', 'whisper-1');
    // Send the patient's selected language when known; otherwise let the API
    // auto-detect (previously hardcoded to English).
    if (language) {
      formData.append('language', language);
    }
    formData.append('response_format', 'text');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
      body: formData as unknown as BodyInit,
    });

    if (!response.ok) {
      throw new Error(`OpenAI Whisper API error: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  private async callWhisperCpp(audioBuffer: Buffer, language?: string): Promise<string> {
    // Multipart form so whisper.cpp receives the patient's selected language
    // per request (the server otherwise falls back to its --language flag).
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' });
    formData.append('file', blob, 'recording.webm');
    if (language) {
      formData.append('language', language);
    }

    const response = await fetch(this.whisperApiUrl, {
      method: 'POST',
      body: formData as unknown as BodyInit,
    });

    if (!response.ok) {
      throw new Error(`whisper.cpp API error: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as { text?: string };
    return result.text?.trim() ?? '';
  }

  async getTranscript(sessionId: string, page: number, limit: number) {
    const session = await this.prisma.intakeSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const [transcripts, total] = await Promise.all([
      this.prisma.sessionTranscript.findMany({
        where: { sessionId },
        orderBy: { timestampMs: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sessionTranscript.count({
        where: { sessionId },
      }),
    ]);

    await this.auditService.log({
      action: 'TRANSCRIPT_VIEW',
      actorId: 'system',
      actorRole: 'SYSTEM',
      resourceType: 'session_transcript',
      resourceId: sessionId,
      details: { transcriptCount: transcripts.length, total, page, limit },
      ipAddress: 'internal',
    });

    return {
      data: transcripts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
