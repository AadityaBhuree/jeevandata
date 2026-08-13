import { Injectable, Logger } from '@nestjs/common';
// ConfigService must stay a VALUE import: NestJS DI resolves constructor
// dependencies via emitDecoratorMetadata, which needs the runtime class.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ConfigService } from '@nestjs/config';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { withRetry } from '@jeevandata/shared-utils';
import type { AiIntakePromptInput } from '@jeevandata/shared-schemas';

const BASE_SYSTEM_PROMPT = `You are a warm, professional medical intake assistant conducting a symptom intake conversation with a patient at a clinic. Your role is to gather structured clinical information through natural conversation.

Required information to collect:
1. Chief complaint (primary reason for visit)
2. Symptom onset and duration
3. Severity (1-10 scale)
4. Associated symptoms
5. Recent changes in medications or habits
6. Allergy status updates

Guidelines:
- Speak in a warm, empathetic tone
- Ask one question at a time
- Use the patient's history to ask context-aware follow-ups
- Never make a diagnosis or prescribe treatment
- If the patient reports emergency symptoms (chest pain, difficulty breathing, severe bleeding), escalate immediately
- Once all required information is gathered, summarize and confirm with the patient`;

const LANGUAGE_MAP: Record<string, string> = {
  en: 'Respond in English.',
  hi: 'कृपया हिंदी में बात करें। (Please respond in Hindi.)',
  mr: 'कृपया मराठीतून बोला. (Please respond in Marathi.)',
  es: 'Responda en español. (Please respond in Spanish.)',
};

@Injectable()
export class IntakeAgentService {
  private readonly logger = new Logger(IntakeAgentService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly anthropicApiKey: string;
  private readonly anthropicModel: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('google.apiKey')!;
    this.model = this.configService.get<string>('google.model', 'gemini-2.0-flash');
    this.anthropicApiKey = this.configService.get<string>('anthropic.apiKey', '');
    this.anthropicModel = this.configService.get<string>(
      'anthropic.model',
      'claude-sonnet-4-20250514',
    );
  }

  private buildSystemPrompt(language: string): string {
    const langInstruction = LANGUAGE_MAP[language] ?? LANGUAGE_MAP['en']!;
    return `${BASE_SYSTEM_PROMPT}

---

Patient language preference: ${language}
${langInstruction}`;
  }

  async processTurn(
    data: AiIntakePromptInput,
  ): Promise<{ response: string; intakeComplete: boolean }> {
    const systemPrompt = this.buildSystemPrompt(data.language ?? 'en');

    const messages = [
      { role: 'assistant' as const, content: systemPrompt },
      ...data.conversationHistory,
      { role: 'user' as const, content: data.currentInput },
    ];

    try {
      // 1. Primary: Gemini with exponential-backoff retry (1s/2s/4s, max 3)
      return await withRetry(() => this.callGemini(messages, systemPrompt), {
        maxAttempts: 3,
        baseDelayMs: 1000,
      });
    } catch (geminiError) {
      // 2. Fallback: Claude (Anthropic Messages API) if a key is configured
      if (this.anthropicApiKey) {
        this.logger.warn(
          `Gemini failed for session ${data.sessionId}, falling back to ${this.anthropicModel}`,
          geminiError,
        );
        try {
          return await withRetry(() => this.callClaude(messages, systemPrompt), {
            maxAttempts: 2,
            baseDelayMs: 1000,
          });
        } catch (claudeError) {
          this.logger.error(
            `Intake agent conversation failed for session ${data.sessionId} (Gemini + Claude fallback)`,
            { geminiError, claudeError },
          );
        }
      } else {
        this.logger.error(
          `Intake agent conversation failed for session ${data.sessionId} (no fallback configured)`,
          geminiError,
        );
      }

      // 3. Never surface a raw error to the patient — hand back a graceful
      //    message summarizing that the conversation continues offline.
      return {
        response:
          "I'm having trouble with my connection right now. Let me summarize what we've discussed so far — please tell me if anything is missing.",
        intakeComplete: false,
      };
    }
  }

  private async callGemini(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
  ): Promise<{ response: string; intakeComplete: boolean }> {
    if (!this.apiKey) {
      // Fallback for development without API key
      return {
        response: 'I understand. Could you please tell me more about what brings you in today?',
        intakeComplete: false,
      };
    }

    // Gemini uses 'model' role instead of 'assistant'
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            maxOutputTokens: 1024,
          },
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} — ${errBody}`);
    }

    const result = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text: string }> };
        finishReason?: string;
      }>;
    };

    const candidate = result.candidates?.[0];
    const responseText = candidate?.content?.parts?.[0]?.text ?? '';
    const finishReason = candidate?.finishReason ?? '';
    // On Gemini, 'STOP' indicates the model naturally finished (intake complete)
    const intakeComplete = finishReason === 'STOP';

    return { response: responseText, intakeComplete };
  }

  /** Anthropic Claude fallback — used only when Gemini is unavailable. */
  private async callClaude(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
  ): Promise<{ response: string; intakeComplete: boolean }> {
    // The Anthropic Messages API takes a system block + a user/assistant
    // alternation; the first message is our system prompt, so strip it.
    const conversation = messages.filter(
      (m) => m.role !== 'assistant' || m.content !== systemPrompt,
    );
    const userMessages = conversation.filter((m) => m.role === 'user');
    const assistantMessages = conversation.filter((m) => m.role === 'assistant');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.anthropicModel,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          ...assistantMessages.slice(0, -1).map((m) => ({ role: 'assistant', content: m.content })),
          ...userMessages.map((m) => ({ role: 'user', content: m.content })),
          { role: 'user', content: messages[messages.length - 1]!.content },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(
        `Anthropic API error: ${response.status} ${response.statusText} — ${errBody}`,
      );
    }

    const result = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      stop_reason?: string;
    };

    const responseText = result.content?.find((c) => c.type === 'text')?.text ?? '';
    // Claude's natural stop ('end_turn') signals the intake is complete
    const intakeComplete = result.stop_reason === 'end_turn';

    return { response: responseText, intakeComplete };
  }
}
