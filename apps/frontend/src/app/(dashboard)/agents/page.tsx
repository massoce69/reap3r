'use client';

import { useState } from 'react';
import { useAgents } from '@/hooks/useApi';
import { getOsIcon, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import {
  Search,
  Server,
  RefreshCw,
} from 'lucide-react';

export default function AgentsListPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [osFilter, setOsFilter] = useState('');

  const { data, isLoading, refetch } = useAgents({
    ...(search && { search }),
    ...(statusFilter && { status: statusFilter }),
    ...(osFilter && { os: osFilter }),
  });

  const agents = (data?.data ?? []) as Array<Record<string, unknown>>;
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agents</h1>
          <p className="text-surface-400 text-sm mt-1">
            {meta?.total ?? 0} machine{(meta?.total ?? 0) !== 1 ? 's' : ''} enrolled
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary btn-sm">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
            placeholder="Search by hostname or IP..."
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
          <option value="">All statuses</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="degraded">Degraded</option>
          <option value="updating">Updating</option>
        </select>
        <select value={osFilter} onChange={(e) => setOsFilter(e.target.value)} className="input w-auto">
          <option value="">All OS</option>
          <option value="windows">Windows</option>
          <option value="linux">Linux</option>
          <option value="macos">macOS</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : agents.length === 0 ? (
        <div className="card p-12 text-center">
          <Server className="w-12 h-12 mx-auto text-surface-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No agents found</h3>
          <p className="text-surface-400 text-sm">Enroll an agent to start monitoring your infrastructure</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700 bg-surface-800/50">
                <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">Hostname</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider hidden md:table-cell">OS</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider hidden lg:table-cell">IP Address</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider hidden lg:table-cell">Version</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider">Last Seen</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase tracking-wider hidden xl:table-cell">Capabilities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700/50">
              {agents.map((agent) => (
                <tr key={agent.id as string} className="hover:bg-surface-800/50 transition-colors cursor-pointer">
                  <td className="py-3 px-4"><span className={`status-${agent.status as string}`} /></td>
                  <td className="py-3 px-4">
                    <Link href={`/agents/${agent.id}`} className="text-white font-medium hover:text-brand-400 transition-colors">
                      {agent.hostname as string}
                    </Link>
                    {agent.source !== 'massvision' && <span className="ml-2 badge-neutral text-[10px]">{agent.source as string}</span>}
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell text-surface-300">
                    {getOsIcon(agent.os as string)} {agent.os as string}
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell text-surface-400 font-mono text-xs">{(agent.ip_address as string) ?? '—'}</td>
                  <td className="py-3 px-4 hidden lg:table-cell text-surface-400 text-xs">v{agent.agent_version as string}</td>
                  <td className="py-3 px-4 text-surface-400 text-sm">{agent.last_seen ? formatRelativeTime(agent.last_seen as string) : 'Never'}</td>
                  <td className="py-3 px-4 hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {((agent.capabilities as string[]) ?? []).slice(0, 3).map((cap) => (
                        <span key={cap} className="badge-info text-[10px]">{cap}</span>
                      ))}
                      {((agent.capabilities as string[]) ?? []).length > 3 && (
                        <span className="badge-neutral text-[10px]">+{((agent.capabilities as string[]) ?? []).length - 3}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
