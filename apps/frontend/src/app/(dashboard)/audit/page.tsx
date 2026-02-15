'use client';

import { useState } from 'react';
import { useAuditLogs } from '@/hooks/useApi';
import { formatRelativeTime, cn } from '@/lib/utils';
import {
  Search,
  Shield,
  RefreshCw,
  User,
  Server,
  LogIn,
  LogOut,
  AlertTriangle,
  Key,
  Settings,
  FileText,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'user.login': <LogIn className="w-4 h-4 text-green-400" />,
  'user.login_failed': <AlertTriangle className="w-4 h-4 text-red-400" />,
  'user.logout': <LogOut className="w-4 h-4 text-surface-400" />,
  'user.locked': <Key className="w-4 h-4 text-red-400" />,
  'agent.enrolled': <Server className="w-4 h-4 text-brand-400" />,
  'agent.deleted': <Server className="w-4 h-4 text-red-400" />,
  'agent.offline': <Server className="w-4 h-4 text-yellow-400" />,
  'job.created': <FileText className="w-4 h-4 text-brand-400" />,
  'job.completed': <FileText className="w-4 h-4 text-green-400" />,
  'job.failed': <FileText className="w-4 h-4 text-red-400" />,
  'job.cancelled': <FileText className="w-4 h-4 text-surface-400" />,
  'settings.updated': <Settings className="w-4 h-4 text-cyan-400" />,
};

const ACTION_COLORS: Record<string, string> = {
  'user.login': 'text-green-400',
  'user.login_failed': 'text-red-400',
  'user.locked': 'text-red-400',
  'agent.enrolled': 'text-brand-400',
  'agent.deleted': 'text-red-400',
  'job.created': 'text-brand-400',
  'job.completed': 'text-green-400',
  'job.failed': 'text-red-400',
};

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const { data, isLoading, refetch } = useAuditLogs({
    ...(search && { search }),
    ...(actionFilter && { action: actionFilter }),
  });

  const logs = (data?.data ?? []) as Array<Record<string, unknown>>;
  const meta = data?.meta;

  const actionTypes = [
    'user.login', 'user.login_failed', 'user.logout', 'user.locked',
    'user.created', 'user.updated', 'user.deleted',
    'agent.enrolled', 'agent.deleted', 'agent.offline',
    'job.created', 'job.completed', 'job.failed', 'job.cancelled', 'job.timeout',
    'settings.updated', 'role.created', 'role.updated', 'role.deleted',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-surface-400 text-sm mt-1">
            Immutable activity trail — {meta?.total ?? 0} entries
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary btn-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
            placeholder="Search by user, IP, or target..."
          />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input w-auto">
          <option value="">All actions</option>
          {actionTypes.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Logs */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card p-12 text-center">
          <Shield className="w-12 h-12 mx-auto text-surface-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No audit logs</h3>
          <p className="text-surface-400 text-sm">Activity will be recorded here as actions occur</p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => {
            const isExpanded = expandedEntry === (log.id as string);
            const icon = ACTION_ICONS[log.action as string] ?? <FileText className="w-4 h-4 text-surface-400" />;
            const actionColor = ACTION_COLORS[log.action as string] ?? 'text-surface-300';

            return (
              <div key={log.id as string} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedEntry(isExpanded ? null : (log.id as string))}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-surface-800/50 transition-colors"
                >
                  <div className="flex-shrink-0 w-4">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-surface-500" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-surface-500" />
                    )}
                  </div>

                  <div className="flex-shrink-0">{icon}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('font-medium text-sm', actionColor)}>
                        {log.action as string}
                      </span>
                      {Boolean(log.target_type) && (
                        <span className="text-surface-500 text-xs">
                          → {log.target_type as string}
                          {log.target_id ? ` (${(log.target_id as string).slice(0, 8)}…)` : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-surface-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {(log.user_email as string) ?? (log.user_id as string)?.slice(0, 8) ?? 'System'}
                      </span>
                      <span>•</span>
                      <span>{(log.ip_address as string) ?? '—'}</span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-surface-500 text-xs">
                    {formatRelativeTime(log.created_at as string)}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-surface-700/50">
                    <div className="pt-3 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <p className="text-surface-500 text-xs uppercase mb-1">Log ID</p>
                          <p className="text-white text-xs font-mono">{log.id as string}</p>
                        </div>
                        <div>
                          <p className="text-surface-500 text-xs uppercase mb-1">User</p>
                          <p className="text-white text-sm">{(log.user_email as string) ?? 'System'}</p>
                        </div>
                        <div>
                          <p className="text-surface-500 text-xs uppercase mb-1">IP Address</p>
                          <p className="text-white text-sm font-mono">{(log.ip_address as string) ?? 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-surface-500 text-xs uppercase mb-1">Timestamp</p>
                          <p className="text-white text-sm">
                            {new Date(log.created_at as string).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {Boolean(log.details) && (
                        <div>
                          <p className="text-surface-500 text-xs uppercase mb-1">Details</p>
                          <pre className="bg-surface-900 rounded-lg p-3 text-xs text-surface-300 font-mono overflow-x-auto max-h-32">
                            {typeof log.details === 'string'
                              ? log.details
                              : JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      )}

                      {Boolean(log.user_agent) && (
                        <div>
                          <p className="text-surface-500 text-xs uppercase mb-1">User Agent</p>
                          <p className="text-surface-400 text-xs break-all">{log.user_agent as string}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
