'use client';

import { useCallback, useRef, useState } from 'react';
import { generateEmbedding, extractLandmarks } from '@/lib/face-embedding';
import { faceApi } from '@/services/api';

export interface MatchResult {
  patientId: string;
  score: number;
  patientName?: string;
  isNewPatient: boolean;
}

interface UseFaceEmbeddingReturn {
  embedding: number[] | null;
  matchResult: MatchResult | null;
  isSearching: boolean;
  error: string | null;
  /** Generate embedding from landmarks and search against Qdrant */
  searchIdentity: (
    landmarks: Array<{ x: number; y: number; z: number }>,
    threshold?: number,
  ) => Promise<MatchResult>;
  /** Generate embedding only (no search) */
  generateFromLandmarks: (landmarks: Array<{ x: number; y: number; z: number }>) => number[];
  /** Register a new patient embedding */
  registerEmbedding: (patientId: string, embedding: number[]) => Promise<void>;
  /** Reset match result */
  reset: () => void;
}

export function useFaceEmbedding(): UseFaceEmbeddingReturn {
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSearchTimeRef = useRef(0);
  const cooldownMs = 2000; // Minimum 2s between searches

  const generateFromLandmarks = useCallback(
    (landmarks: Array<{ x: number; y: number; z: number }>): number[] => {
      const normalizedLandmarks = extractLandmarks(landmarks);
      const emb = generateEmbedding(normalizedLandmarks);
      setEmbedding(emb);
      return emb;
    },
    [],
  );

  const searchIdentity = useCallback(
    async (
      landmarks: Array<{ x: number; y: number; z: number }>,
      threshold = 0.82,
    ): Promise<MatchResult> => {
      // Rate limit searches
      const now = Date.now();
      if (now - lastSearchTimeRef.current < cooldownMs) {
        // Return the last match result if within cooldown
        if (matchResult) return matchResult;
      }
      lastSearchTimeRef.current = now;

      setIsSearching(true);
      setError(null);

      try {
        const emb = generateFromLandmarks(landmarks);

        const results = await faceApi.searchByFace({
          vector: emb,
          threshold,
          limit: 1,
        });

        if (results.length > 0 && results[0]) {
          const match: MatchResult = {
            patientId: results[0].patientId,
            score: results[0].score,
            isNewPatient: false,
          };
          setMatchResult(match);
          return match;
        }

        // No match found — this is a new patient
        const noMatch: MatchResult = {
          patientId: '',
          score: 0,
          isNewPatient: true,
        };
        setMatchResult(noMatch);
        return noMatch;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Face search failed';
        setError(message);
        throw err;
      } finally {
        setIsSearching(false);
      }
    },
    [generateFromLandmarks, matchResult],
  );

  const registerEmbedding = useCallback(async (patientId: string, emb: number[]) => {
    try {
      await faceApi.upsertEmbedding({
        patientId,
        vector: emb,
      });
      setMatchResult({
        patientId,
        score: 1.0,
        isNewPatient: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Embedding registration failed';
      setError(message);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setEmbedding(null);
    setMatchResult(null);
    setError(null);
  }, []);

  return {
    embedding,
    matchResult,
    isSearching,
    error,
    searchIdentity,
    generateFromLandmarks,
    registerEmbedding,
    reset,
  };
}
