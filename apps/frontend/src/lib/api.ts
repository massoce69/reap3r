// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - API Client
// ─────────────────────────────────────────────────────────────

import type { ApiResponse, ApiError } from '@massvision/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle 401 - try refresh
      if (response.status === 401 && token) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry with new token
          headers['Authorization'] = `Bearer ${this.getToken()}`;
          const retryResponse = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers,
          });
          return retryResponse.json();
        } else {
          // Redirect to login
          if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
          }
        }
      }

      throw data as ApiError;
    }

    return data;
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      localStorage.setItem('access_token', data.data.access_token);
      localStorage.setItem('refresh_token', data.data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  // Auth
  async login(email: string, password: string) {
    const res = await this.request<{
      access_token: string;
      refresh_token: string;
      user: Record<string, unknown>;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('refresh_token', res.data.refresh_token);
    return res.data;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }

  async getMe() {
    return this.request<Record<string, unknown>>('/auth/me');
  }

  // Dashboard
  async getDashboardStats() {
    return this.request<Record<string, unknown>>('/api/dashboard/stats');
  }

  // Agents
  async getAgents(params?: Record<string, string>) {
    const searchParams = new URLSearchParams(params);
    return this.request<Record<string, unknown>[]>(`/api/agents?${searchParams}`);
  }

  async getAgent(id: string) {
    return this.request<Record<string, unknown>>(`/api/agents/${id}`);
  }

  async getAgentMetrics(id: string, params?: Record<string, string>) {
    const searchParams = new URLSearchParams(params);
    return this.request<Record<string, unknown>[]>(`/api/agents/${id}/metrics?${searchParams}`);
  }

  async getAgentInventory(id: string) {
    return this.request<Record<string, unknown>>(`/api/agents/${id}/inventory/latest`);
  }

  async deleteAgent(id: string) {
    return this.request(`/api/agents/${id}`, { method: 'DELETE' });
  }

  // Jobs
  async createJob(data: {
    agent_id: string;
    type: string;
    payload: Record<string, unknown>;
    timeout_sec?: number;
    priority?: string;
  }) {
    return this.request<Record<string, unknown>>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getJobs(params?: Record<string, string>) {
    const searchParams = new URLSearchParams(params);
    return this.request<Record<string, unknown>[]>(`/api/jobs?${searchParams}`);
  }

  async getJob(id: string) {
    return this.request<Record<string, unknown>>(`/api/jobs/${id}`);
  }

  async getJobResult(id: string) {
    return this.request<Record<string, unknown>>(`/api/jobs/${id}/result`);
  }

  async cancelJob(id: string) {
    return this.request(`/api/jobs/${id}/cancel`, { method: 'POST' });
  }

  // Audit Logs
  async getAuditLogs(params?: Record<string, string>) {
    const searchParams = new URLSearchParams(params);
    return this.request<Record<string, unknown>[]>(`/api/audit-logs?${searchParams}`);
  }
}

export const api = new ApiClient(API_URL);
