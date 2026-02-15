// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - React Query Hooks
// ─────────────────────────────────────────────────────────────

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => api.getDashboardStats(),
    refetchInterval: 15000,
  });
}

// ═══════════════════════════════════════════════════════════════
// Agents
// ═══════════════════════════════════════════════════════════════

export function useAgents(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['agents', params],
    queryFn: () => api.getAgents(params),
    refetchInterval: 10000,
  });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () => api.getAgent(id),
    enabled: !!id,
    refetchInterval: 10000,
  });
}

export function useAgentMetrics(id: string, params?: Record<string, string>) {
  return useQuery({
    queryKey: ['agents', id, 'metrics', params],
    queryFn: () => api.getAgentMetrics(id, params),
    enabled: !!id,
    refetchInterval: 30000,
  });
}

export function useAgentInventory(id: string) {
  return useQuery({
    queryKey: ['agents', id, 'inventory'],
    queryFn: () => api.getAgentInventory(id),
    enabled: !!id,
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete agent: ${error.message}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// Jobs
// ═══════════════════════════════════════════════════════════════

export function useJobs(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => api.getJobs(params),
    refetchInterval: 5000,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => api.getJob(id),
    enabled: !!id,
    refetchInterval: 3000,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      agent_id: string;
      type: string;
      payload: Record<string, unknown>;
      timeout_sec?: number;
      priority?: string;
    }) => api.createJob(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create job: ${error.message}`);
    },
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.cancelJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job cancelled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel job: ${error.message}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// Audit Logs
// ═══════════════════════════════════════════════════════════════

export function useAuditLogs(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => api.getAuditLogs(params),
  });
}
