// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Utility Functions
// ─────────────────────────────────────────────────────────────

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'online': return 'text-green-400';
    case 'offline': return 'text-red-400';
    case 'degraded': return 'text-yellow-400';
    case 'updating': return 'text-blue-400';
    case 'success': return 'text-green-400';
    case 'failed': return 'text-red-400';
    case 'timeout': return 'text-yellow-400';
    case 'pending': return 'text-blue-400';
    case 'queued': return 'text-blue-300';
    case 'running': return 'text-cyan-400';
    case 'cancelled': return 'text-surface-400';
    default: return 'text-surface-400';
  }
}

export function getStatusBadge(status: string): string {
  switch (status) {
    case 'online':
    case 'success':
      return 'badge-success';
    case 'offline':
    case 'failed':
      return 'badge-danger';
    case 'degraded':
    case 'timeout':
    case 'pending':
      return 'badge-warning';
    case 'running':
    case 'queued':
    case 'updating':
      return 'badge-info';
    default:
      return 'badge-neutral';
  }
}

export function getOsIcon(os: string): string {
  switch (os) {
    case 'windows': return '🪟';
    case 'linux': return '🐧';
    case 'macos': return '🍎';
    default: return '💻';
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}
