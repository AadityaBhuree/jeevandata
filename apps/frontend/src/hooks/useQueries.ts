'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, analyticsApi } from '@/services/api';

// ─── Types ──────────────────────────────────────────────────────

export interface ActiveSession {
  id: string;
  patient: { id: string; name: string; dob: string } | null;
  status: string;
  startedAt: string;
  deviceId: string;
}

export interface BriefRecord {
  id: string;
  sessionId: string;
  patientId: string;
  brief: {
    summary?: string;
    chiefComplaint?: string;
    riskFlags?: string[];
    vitalsToCheck?: string[];
    suggestedFollowups?: string[];
    medicationsNote?: string;
    icd10Hints?: string[];
  };
  generatedAt: string;
  session: { id: string; startedAt: string; status: string };
  patient?: { id: string; name: string; dob: string } | null;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Queries ────────────────────────────────────────────────────

/** Active intake sessions. Refetches on window focus (React Query default). */
export function useActiveSessions(limit = 50) {
  return useQuery({
    queryKey: ['active-sessions', limit],
    queryFn: async () => {
      const res = await dashboardApi.getActiveSessions(1, limit);
      return (res.data as ActiveSession[]) ?? [];
    },
  });
}

/** Paginated active intake sessions with server pagination metadata. */
export function usePaginatedActiveSessions(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['active-sessions-paginated', page, limit],
    queryFn: async () => {
      const res = await dashboardApi.getActiveSessions(page, limit);
      return {
        sessions: (res.data as ActiveSession[]) ?? [],
        pagination: (res.pagination as unknown as PaginationInfo) ?? {
          page,
          limit,
          total: 0,
          totalPages: 1,
        },
      };
    },
  });
}

/** Recent generated briefs awaiting review. */
export function useRecentBriefs(limit = 20) {
  return useQuery({
    queryKey: ['recent-briefs', limit],
    queryFn: async () => {
      const res = await dashboardApi.getRecentBriefs(1, limit);
      return (res.data as BriefRecord[]) ?? [];
    },
  });
}

/** Paginated recent generated briefs with server pagination metadata. */
export function usePaginatedRecentBriefs(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['recent-briefs-paginated', page, limit],
    queryFn: async () => {
      const res = await dashboardApi.getRecentBriefs(page, limit);
      return {
        briefs: (res.data as BriefRecord[]) ?? [],
        pagination: (res.pagination as unknown as PaginationInfo) ?? {
          page,
          limit,
          total: 0,
          totalPages: 1,
        },
      };
    },
  });
}

/** Analytics overview KPIs for the admin analytics dashboard. */
export function useAnalyticsOverview(days = 30) {
  return useQuery({
    queryKey: ['analytics', 'overview', days],
    queryFn: () => analyticsApi.getOverview(days),
    staleTime: 60_000,
  });
}

// ─── Mutations ──────────────────────────────────────────────────

/** Mark a brief as reviewed — invalidates the recent-briefs list on success. */
export function useMarkBriefReviewed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (briefId: string) => dashboardApi.markBriefReviewed(briefId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-briefs'] });
    },
  });
}
