import { IntakeAgentService } from './intake-agent.service';
import type { ConfigService } from '@nestjs/config';
import type { AiIntakePromptInput } from '@jeevandata/shared-schemas';

function makeConfig(overrides: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string, fallback?: unknown) => {
      const map: Record<string, unknown> = {
        'google.apiKey': 'gemini-key',
        'google.model': 'gemini-2.0-flash',
        'anthropic.apiKey': '',
        'anthropic.model': 'claude-sonnet-4-20250514',
        ...overrides,
      };
      const hit = map[key];
      return hit === undefined || hit === null ? fallback : hit;
    }),
  } as unknown as ConfigService;
}

const sampleInput: AiIntakePromptInput = {
  sessionId: 'sess-1',
  patientContext: 'Test Patient, 45-year-old, no allergies on file',
  currentInput: 'I have a headache',
  conversationHistory: [{ role: 'user', content: 'Hello' }],
  language: 'en',
};

const geminiOkResponse = () =>
  new Response(
    JSON.stringify({
      candidates: [
        { content: { parts: [{ text: 'Okay, when did it start?' }] }, finishReason: 'STOP' },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

describe('IntakeAgentService — retry & fallback (8.5.2)', () => {
  let service: IntakeAgentService;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('returns the Gemini response on success', async () => {
    service = new IntakeAgentService(makeConfig());
    fetchMock.mockResolvedValue(geminiOkResponse());

    const result = await service.processTurn(sampleInput);

    expect(result.response).toBe('Okay, when did it start?');
    expect(result.intakeComplete).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries Gemini with backoff before giving up', async () => {
    service = new IntakeAgentService(makeConfig());
    fetchMock.mockRejectedValue(new Error('network blip'));

    const result = await service.processTurn(sampleInput);

    // 3 Gemini attempts, all failed
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
    // No Claude configured → graceful message, no throw
    expect(result.intakeComplete).toBe(false);
    expect(result.response).toContain('having trouble');
  });

  it('falls back to Claude when Gemini fails and a key is configured', async () => {
    service = new IntakeAgentService(makeConfig({ 'anthropic.apiKey': 'claude-key' }));
    fetchMock
      .mockRejectedValueOnce(new Error('gemini down')) // all 3 gemini attempts fail
      .mockRejectedValueOnce(new Error('gemini down'))
      .mockRejectedValueOnce(new Error('gemini down'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [{ type: 'text', text: 'Tell me more about the headache.' }],
            stop_reason: 'end_turn',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const result = await service.processTurn(sampleInput);

    // 3 Gemini + 1 Claude attempt
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][0]).toContain('api.anthropic.com');
    expect(result.response).toBe('Tell me more about the headache.');
    expect(result.intakeComplete).toBe(true);
  });

  it('returns a graceful message when both providers fail', async () => {
    service = new IntakeAgentService(makeConfig({ 'anthropic.apiKey': 'claude-key' }));
    fetchMock.mockRejectedValue(new Error('everything down'));

    const result = await service.processTurn(sampleInput);

    // 3 Gemini + 2 Claude attempts
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(result.response).toContain('having trouble');
    expect(result.intakeComplete).toBe(false);
  });

  it('throws Gemini API errors through withRetry (non-network HTTP error)', async () => {
    service = new IntakeAgentService(makeConfig());
    fetchMock.mockResolvedValue(
      new Response('rate limited', { status: 429, statusText: 'Too Many Requests' }),
    );

    const result = await service.processTurn(sampleInput);

    expect(result.response).toContain('having trouble');
    expect(result.intakeComplete).toBe(false);
  });
});
