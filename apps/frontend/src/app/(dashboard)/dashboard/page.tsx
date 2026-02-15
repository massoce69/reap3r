'use client';

import { useDashboardStats } from '@/hooks/useApi';
import { formatRelativeTime, getStatusBadge } from '@/lib/utils';
import {
  Server,
  Wifi,
  WifiOff,
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  XCircle,
  Clock,
  Monitor,
} from 'lucide-react';

export default function DashboardPage() {
  const { data, isLoading } = useDashboardStats();
  const stats = data?.data as Record<string, unknown> | undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalAgents = (stats?.total_agents as number) ?? 0;
  const onlineAgents = (stats?.online_agents as number) ?? 0;
  const offlineAgents = (stats?.offline_agents as number) ?? 0;
  const degradedAgents = (stats?.degraded_agents as number) ?? 0;
  const totalJobsToday = (stats?.total_jobs_today as number) ?? 0;
  const successfulJobs = (stats?.successful_jobs_today as number) ?? 0;
  const failedJobs = (stats?.failed_jobs_today as number) ?? 0;
  const pendingJobs = (stats?.pending_jobs as number) ?? 0;
  const activeSessions = (stats?.active_remote_sessions as number) ?? 0;
  const alerts = (stats?.recent_alerts as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-surface-400 text-sm mt-1">Overview of your infrastructure</p>
      </div>

      {/* Agent Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Agents"
          value={totalAgents}
          icon={<Server className="w-5 h-5" />}
          color="text-brand-400"
          bgColor="bg-brand-500/10"
        />
        <StatCard
          title="Online"
          value={onlineAgents}
          icon={<Wifi className="w-5 h-5" />}
          color="text-green-400"
          bgColor="bg-green-500/10"
          subtitle={totalAgents > 0 ? `${Math.round((onlineAgents / totalAgents) * 100)}%` : '-%'}
        />
        <StatCard
          title="Offline"
          value={offlineAgents}
          icon={<WifiOff className="w-5 h-5" />}
          color="text-red-400"
          bgColor="bg-red-500/10"
        />
        <StatCard
          title="Degraded"
          value={degradedAgents}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="text-yellow-400"
          bgColor="bg-yellow-500/10"
        />
      </div>

      {/* Job Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Jobs Today"
          value={totalJobsToday}
          icon={<BriefcaseBusiness className="w-5 h-5" />}
          color="text-brand-400"
          bgColor="bg-brand-500/10"
        />
        <StatCard
          title="Successful"
          value={successfulJobs}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="text-green-400"
          bgColor="bg-green-500/10"
        />
        <StatCard
          title="Failed"
          value={failedJobs}
          icon={<XCircle className="w-5 h-5" />}
          color="text-red-400"
          bgColor="bg-red-500/10"
        />
        <StatCard
          title="Pending"
          value={pendingJobs}
          icon={<Clock className="w-5 h-5" />}
          color="text-yellow-400"
          bgColor="bg-yellow-500/10"
        />
      </div>

      {/* Active Sessions & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Remote Sessions */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-white">Active Remote Sessions</h3>
          </div>
          <div className="text-3xl font-bold text-cyan-400">{activeSessions}</div>
          <p className="text-sm text-surface-500 mt-1">Shell + Desktop sessions</p>
        </div>

        {/* Recent Alerts */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold text-white">Recent Alerts (24h)</h3>
          </div>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-surface-500">
              <CheckCircle2 className="w-8 h-8 mb-2 text-green-500/50" />
              <p className="text-sm">All clear — no alerts</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {alerts.slice(0, 10).map((alert, idx) => (
                <div key={idx} className="flex items-start gap-3 py-2 border-b border-surface-700/50 last:border-0">
                  <span className={getStatusBadge(alert.type as string)}>
                    {alert.type as string}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-200 truncate">{alert.message as string}</p>
                    <p className="text-xs text-surface-500">{formatRelativeTime(alert.created_at as string)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  bgColor,
  subtitle,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  subtitle?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-surface-400">{title}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-white">{value}</span>
            {subtitle && <span className="text-xs text-surface-500">{subtitle}</span>}
          </div>
        </div>
        <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
