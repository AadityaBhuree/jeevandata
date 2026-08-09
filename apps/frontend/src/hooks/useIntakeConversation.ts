'use client';

import { useCallback, useRef, useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useOfflineStore } from '@/stores/offline-store';
import { aiApi, intakeApi } from '@/services/api';
import { cacheTranscripts, cacheBrief } from '@/services/db';
import { enqueueIntakeMutation } from '@/services/sync';
import { toast } from '@/hooks/use-toast';

export interface ConversationTurn {
  role: 'ai' | 'patient';
  content: string;
  timestamp: number;
}

interface UseIntakeConversationReturn {
  turns: ConversationTurn[];
  isAiThinking: boolean;
  isIntakeComplete: boolean;
  patientInput: string;
  setPatientInput: (input: string) => void;
  sendPatientMessage: (text: string) => Promise<void>;
  startConversation: (
    patientName: string,
    patientContext?: string,
    language?: string,
  ) => Promise<void>;
  completeIntake: () => Promise<void>;
  reset: () => void;
}

export function useIntakeConversation(sessionId: string): UseIntakeConversationReturn {
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isIntakeComplete, setIsIntakeComplete] = useState(false);
  const [patientInput, setPatientInput] = useState('');

  const addTranscript = useSessionStore((s) => s.addTranscript);
  const setStatus = useSessionStore((s) => s.setStatus);
  const setBrief = useSessionStore((s) => s.setBrief);
  const languageRef = useRef('en');
  const patientNameRef = useRef('');
  const patientIdRef = useRef<string | undefined>(undefined);
  const turnsRef = useRef<ConversationTurn[]>([]);

  const startConversation = useCallback(
    async (patientName: string, patientContext?: string, language?: string) => {
      patientNameRef.current = patientName;
      if (patientContext) patientIdRef.current = patientContext;
      if (language) languageRef.current = language;
      setStatus('intake_in_progress');
      setIsAiThinking(true);

      // Make initial AI greeting
      const greeting = await aiApi.processIntake({
        sessionId,
        patientContext: patientContext ?? `${patientName} — returning patient`,
        conversationHistory: [
          {
            role: 'user',
            content: `The patient ${patientName} has just arrived. Start the intake conversation naturally.`,
          },
        ],
        currentInput: 'Start the conversation.',
        language: languageRef.current,
      });

      const aiTurn: ConversationTurn = {
        role: 'ai',
        content: greeting.response,
        timestamp: Date.now(),
      };
      setTurns([aiTurn]);
      turnsRef.current = [aiTurn];

      addTranscript({
        id: `ai-${Date.now()}`,
        speaker: 'ai',
        text: greeting.response,
        timestamp: Date.now(),
      });

      // Persist the transcript locally for offline viewing
      void cacheTranscripts(
        sessionId,
        turnsRef.current.map((t) => ({
          speaker: t.role,
          text: t.content,
          timestamp: t.timestamp,
        })),
      ).catch(() => {});

      if (greeting.intakeComplete) {
        setIsIntakeComplete(true);
      }

      setIsAiThinking(false);
    },
    [sessionId, setStatus, addTranscript],
  );

  const sendPatientMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isAiThinking || isIntakeComplete) return;

      const patientTurn: ConversationTurn = {
        role: 'patient',
        content: text.trim(),
        timestamp: Date.now(),
      };

      const updatedTurns = [...turnsRef.current, patientTurn];
      setTurns(updatedTurns);
      turnsRef.current = updatedTurns;

      addTranscript({
        id: `pt-${Date.now()}`,
        speaker: 'patient',
        text: text.trim(),
        timestamp: Date.now(),
      });

      // Cache locally so the conversation survives an offline reconnect
      void cacheTranscripts(
        sessionId,
        updatedTurns.map((t) => ({
          speaker: t.role,
          text: t.content,
          timestamp: t.timestamp,
        })),
      ).catch(() => {});

      setPatientInput('');
      setIsAiThinking(true);

      try {
        // Build conversation history for the API
        const conversationHistory = updatedTurns.slice(0, -1).map((t) => ({
          role: t.role === 'ai' ? ('assistant' as const) : ('user' as const),
          content: t.content,
        }));

        const response = await aiApi.processIntake({
          sessionId,
          patientContext: `Patient: ${patientNameRef.current}`,
          conversationHistory,
          currentInput: text.trim(),
          language: languageRef.current,
        });

        const aiTurn: ConversationTurn = {
          role: 'ai',
          content: response.response,
          timestamp: Date.now(),
        };

        const finalTurns = [...turnsRef.current, aiTurn];
        setTurns(finalTurns);
        turnsRef.current = finalTurns;

        addTranscript({
          id: `ai-${Date.now()}`,
          speaker: 'ai',
          text: response.response,
          timestamp: Date.now(),
        });

        void cacheTranscripts(
          sessionId,
          finalTurns.map((t) => ({
            speaker: t.role,
            text: t.content,
            timestamp: t.timestamp,
          })),
        ).catch(() => {});

        if (response.intakeComplete) {
          setIsIntakeComplete(true);
          toast({
            title: 'Intake Complete',
            description: 'The AI has gathered all required information.',
            variant: 'success',
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'AI response failed';
        toast({
          title: 'Conversation Error',
          description: errorMessage,
          variant: 'destructive',
        });

        // Add a system message about the error
        addTranscript({
          id: `sys-${Date.now()}`,
          speaker: 'system',
          text: 'Sorry, I encountered an error. Please try again.',
          timestamp: Date.now(),
        });
      } finally {
        setIsAiThinking(false);
      }
    },
    [sessionId, isAiThinking, isIntakeComplete, addTranscript],
  );

  const completeIntake = useCallback(async () => {
    setStatus('transcribing');

    // Extract structured intake data from the conversation
    const transcript = turnsRef.current
      .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
      .join('\n');

    // For production, this would send to the /ai/brief endpoint
    // with the AI extracting structured data from the transcript
    const intakeData = {
      patientId: patientIdRef.current,
      chiefComplaint: turnsRef.current.length > 0 ? (turnsRef.current[0]?.content ?? '') : '',
      symptoms: [],
      associated: [],
      medicationChanges: '',
      allergyUpdates: '',
      patientNotes: transcript,
    };

    try {
      const result = await intakeApi.completeSession(sessionId, intakeData);

      // Store the generated brief so the BriefCard can display real AI-generated data
      const briefData = 'brief' in result ? (result.brief as Record<string, unknown>) : null;
      if (briefData) {
        setBrief(briefData);
        // Cache the brief locally for offline viewing
        void cacheBrief(sessionId, briefData).catch(() => {});
      }

      toast({
        title: 'Brief Generated',
        description: 'The clinical brief is ready for the doctor.',
        variant: 'success',
      });
    } catch (err) {
      // Offline (or network failure) — queue the mutation for later replay
      if (!useOfflineStore.getState().isOnline) {
        await enqueueIntakeMutation('COMPLETE_SESSION', {
          sessionId,
          intakeData,
        }).catch(() => {});
        toast({
          title: 'Saved Offline',
          description:
            'You are offline. The intake was saved on this device and will sync automatically when you reconnect.',
          variant: 'success',
        });
        // Do NOT re-throw — the data is safe in the outbox
        return;
      }

      toast({
        title: 'Failed to Generate Brief',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      throw err; // Re-throw so the calling page can gate the phase transition
    }
  }, [sessionId, setStatus, setBrief]);

  const reset = useCallback(() => {
    setTurns([]);
    setIsAiThinking(false);
    setIsIntakeComplete(false);
    setPatientInput('');
    turnsRef.current = [];
    patientNameRef.current = '';
    languageRef.current = 'en';
  }, []);

  return {
    turns,
    isAiThinking,
    isIntakeComplete,
    patientInput,
    setPatientInput,
    sendPatientMessage,
    startConversation,
    completeIntake,
    reset,
  };
}
