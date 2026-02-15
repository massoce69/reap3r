'use client';

import { useState } from 'react';
import { useJobs, useCancelJob } from '@/hooks/useApi';
import { formatRelativeTime, formatDuration, getStatusBadge, cn } from '@/lib/utils';
import {
  Search,
  Play,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

export default function JobsListPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const { data, isLoading, refetch } = useJobs({
    ...(search && { search }),
    ...(statusFilter && { status: statusFilter }),
    ...(typeFilter && { type: typeFilter }),
  });

  const cancelJob = useCancelJob();

  const jobs = (data?.data ?? []) as Array<Record<string, unknown>>;
  const meta = data?.meta;

  const jobTypes = [
    'run_script', 'remote_shell_start', 'remote_shell_stop',
    'remote_desktop_start', 'remote_desktop_stop',
    'reboot', 'shutdown', 'wake_on_lan', 'agent_update',
    'service_restart', 'service_stop', 'service_start',
    'process_kill', 'artifact_upload', 'artifact_download',
    'webcam_capture',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <p className="text-surface-400 text-sm mt-1">
            {meta?.total ?? 0} total job{(meta?.total ?? 0) !== 1 ? 's' : ''}
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
            placeholder="Search by agent hostname or job ID..."
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="timeout">Timeout</option>
          <option value="cancelled">Cancelled</option>
          <option value="agent_offline">Agent Offline</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input w-auto">
          <option value="">All types</option>
          {jobTypes.map(t => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Jobs Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="card p-12 text-center">
          <Play className="w-12 h-12 mx-auto text-surface-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No jobs found</h3>
          <p className="text-surface-400 text-sm">
            {statusFilter || typeFilter ? 'Try adjusting your filters' : 'Run a script or command on an agent to create a job'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => {
            const isExpanded = expandedJob === (job.id as string);
            const canCancel = ['pending', 'queued', 'running'].includes(job.status as string);
            const duration = job.completed_at
              ? Math.round((new Date(job.completed_at as string).getTime() - new Date(job.created_at as string).getTime()) / 1000)
              : null;

            return (
              <div key={job.id as string} className="card overflow-hidden">
                {/* Job Row */}
                <button
                  onClick={() => setExpandedJob(isExpanded ? null : (job.id as string))}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-800/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-surface-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-surface-500" />
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    <span className={cn('px-2.5 py-1 rounded text-xs font-medium', getStatusBadge(job.status as string))}>
                      {job.status as string}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">{(job.type as string).replace(/_/g, ' ')}</span>
                      <span className="text-surface-500 text-xs font-mono">
                        {(job.id as string).slice(0, 8)}…
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-surface-400">
                      <span>Agent: {(job.agent_hostname as string) ?? (job.agent_id as string)?.slice(0, 8)}</span>
                      <span>•</span>
                      <span>{formatRelativeTime(job.created_at as string)}</span>
                      {duration !== null && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDuration(duration)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-2">
                    {job.priority === 'critical' && (
                      <span className="badge-danger text-[10px]">CRITICAL</span>
                    )}
                    {job.priority === 'high' && (
                      <span className="badge-warning text-[10px]">HIGH</span>
                    )}
                    {canCancel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelJob.mutate(job.id as string);
                        }}
                        className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Cancel job"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-surface-700/50">
                    <div className="pt-4 space-y-4">
                      {/* Job Info Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-surface-500 text-xs uppercase mb-1">Job ID</p>
                          <p className="text-white text-sm font-mono">{job.id as string}</p>
                        </div>
                        <div>
                          <p className="text-surface-500 text-xs uppercase mb-1">Agent</p>
                          <Link href={`/agents/${job.agent_id}`} className="text-brand-400 text-sm hover:underline">
                            {(job.agent_hostname as string) ?? (job.agent_id as string)}
                          </Link>
                        </div>
                        <div>
                          <p className="text-surface-500 text-xs uppercase mb-1">Created By</p>
                          <p className="text-white text-sm">{(job.created_by_name as string) ?? 'System'}</p>
                        </div>
                        <div>
                          <p className="text-surface-500 text-xs uppercase mb-1">Timeout</p>
                          <p className="text-white text-sm">{String(job.timeout_sec)}s</p>
                        </div>
                      </div>

                      {/* Payload */}
                      {Boolean(job.payload) && (
                        <div>
                          <p className="text-surface-500 text-xs uppercase mb-1">Payload</p>
                          <pre className="bg-surface-900 rounded-lg p-3 text-xs text-surface-300 font-mono overflow-x-auto max-h-32">
                            {JSON.stringify(job.payload, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Result Output */}
                      {(Boolean(job.stdout) || Boolean(job.stderr)) && (
                        <div className="space-y-2">
                          {Boolean(job.stdout) && (
                            <div>
                              <p className="text-surface-500 text-xs uppercase mb-1">Standard Output</p>
                              <pre className="bg-surface-900 rounded-lg p-3 text-xs text-green-300 font-mono overflow-x-auto max-h-48">
                                {job.stdout as string}
                              </pre>
                            </div>
                          )}
                          {Boolean(job.stderr) && (
                            <div>
                              <p className="text-surface-500 text-xs uppercase mb-1">Standard Error</p>
                              <pre className="bg-surface-900 rounded-lg p-3 text-xs text-red-300 font-mono overflow-x-auto max-h-48">
                                {job.stderr as string}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Error Message */}
                      {Boolean(job.error_message) && (
                        <div>
                          <p className="text-surface-500 text-xs uppercase mb-1">Error</p>
                          <p className="text-red-400 text-sm">{job.error_message as string}</p>
                        </div>
                      )}

                      {/* Exit Code */}
                      {job.exit_code !== undefined && job.exit_code !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-surface-500 text-xs uppercase">Exit Code:</span>
                          <span className={cn(
                            'font-mono text-sm',
                            job.exit_code === 0 ? 'text-green-400' : 'text-red-400'
                          )}>
                            {String(job.exit_code)}
                          </span>
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
