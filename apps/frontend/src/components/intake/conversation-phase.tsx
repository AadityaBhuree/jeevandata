'use client';

import { cn } from '@/lib/utils';
import { TranscriptView } from '@/components/intake/transcript-view';
import { VoiceInput } from '@/components/intake/VoiceInput';

interface ConversationPhaseProps {
  sessionId: string;
  patientName: string;
  transcripts: Array<{
    id: string;
    speaker: 'patient' | 'ai' | 'system';
    text: string;
    timestamp: number;
  }>;
  patientInput: string;
  onPatientInputChange: (v: string) => void;
  onSend: (text?: string) => void;
  isAiThinking: boolean;
  isComplete: boolean;
  onComplete: () => void;
}

export function ConversationPhase({
  sessionId,
  patientName,
  transcripts,
  patientInput,
  onPatientInputChange,
  onSend,
  isAiThinking,
  isComplete,
  onComplete,
}: ConversationPhaseProps) {
  return (
    <>
      <div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div
              aria-hidden="true"
              className={cn(
                'h-2 w-2 rounded-full',
                isAiThinking ? 'animate-pulse bg-amber-400' : 'bg-emerald-500',
              )}
            />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              AI Voice Intake
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {isAiThinking && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <span className="flex gap-0.5">
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400"
                    style={{ animationDelay: '300ms' }}
                  />
                </span>
                Thinking
              </span>
            )}
            {!isAiThinking && !isComplete && (
              <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                In conversation
              </span>
            )}
            {isComplete && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                All info gathered
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: '400px' }}>
          {transcripts.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  {isAiThinking ? 'AI is preparing your intake...' : 'Starting AI intake...'}
                </p>
                {isAiThinking && (
                  <div className="mt-3 flex justify-center gap-1">
                    <span
                      className="bg-jeevandata-400 h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="bg-jeevandata-400 h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="bg-jeevandata-400 h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <TranscriptView entries={transcripts} onStartIntake={() => {}} />
          )}
        </div>
        <VoiceInput
          value={patientInput}
          onChange={onPatientInputChange}
          onSend={onSend}
          disabled={isAiThinking}
          isComplete={isComplete}
          sessionId={sessionId}
          patientName={patientName}
        />
      </div>
      {isComplete && (
        <div className="flex gap-3">
          <button
            onClick={onComplete}
            className="bg-jeevandata-500 hover:bg-jeevandata-600 flex flex-1 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98]"
          >
            Complete Intake and Generate Brief
          </button>
        </div>
      )}
    </>
  );
}
