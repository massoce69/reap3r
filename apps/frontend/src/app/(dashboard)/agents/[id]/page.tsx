'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAgent, useAgentMetrics, useAgentInventory, useDeleteAgent, useCreateJob, useJobs } from '@/hooks/useApi';
import { useWebSocketEvent } from '@/hooks/useWebSocket';
import { getOsIcon, formatRelativeTime, formatBytes, formatDuration, getStatusBadge, cn } from '@/lib/utils';
import {
  ArrowLeft,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Terminal,
  Play,
  Power,
  Trash2,
  RefreshCw,
  Shield,
  WifiOff,
  Download,
  Upload,
  Activity,
  Globe,
  User,
  Package,
  Clock,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import RunScriptDialog from '@/components/RunScriptDialog';
import RemoteShellPanel from '@/components/RemoteShellPanel';

type TabKey = 'overview' | 'metrics' | 'inventory' | 'jobs' | 'shell';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [showRunScript, setShowRunScript] = useState(false);
  const [showShell, setShowShell] = useState(false);

  const { data: agentResp, isLoading, refetch } = useAgent(agentId);
  const { data: metricsResp } = useAgentMetrics(agentId, { period: '1h' });
  const { data: inventoryResp } = useAgentInventory(agentId);
  const deleteAgent = useDeleteAgent();
  const createJob = useCreateJob();

  // Live updates via WebSocket
  useWebSocketEvent('agent.status_changed', (payload) => {
    if ((payload as Record<string, unknown>).agent_id === agentId) {
      refetch();
    }
  });

  const agent = agentResp?.data as Record<string, unknown> | undefined;
  const metrics = (metricsResp?.data ?? []) as Array<Record<string, unknown>>;
  const inventory = inventoryResp?.data as Record<string, unknown> | undefined;

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-24">
        <WifiOff className="w-12 h-12 mx-auto text-surface-600 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Agent not found</h3>
        <Link href="/agents" className="text-brand-400 hover:underline">Back to agents</Link>
      </div>
    );
  }

  const isOnline = agent.status === 'online';
  const latestMetric = metrics[0] as Record<string, unknown> | undefined;

  const handleReboot = () => {
    if (!confirm('Are you sure you want to reboot this machine?')) return;
    createJob.mutate({
      agent_id: agentId,
      type: 'reboot',
      payload: { force: false },
    });
  };

  const handleShutdown = () => {
    if (!confirm('⚠️ SHUTDOWN: Are you sure? The machine will power off.')) return;
    createJob.mutate({
      agent_id: agentId,
      type: 'shutdown',
      payload: { force: false, delay_sec: 0 },
    });
  };

  const handleDelete = () => {
    if (!confirm('Delete this agent permanently? This cannot be undone.')) return;
    deleteAgent.mutate(agentId, {
      onSuccess: () => router.push('/agents'),
    });
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { key: 'metrics', label: 'Metrics', icon: <Cpu className="w-4 h-4" /> },
    { key: 'inventory', label: 'Inventory', icon: <Package className="w-4 h-4" /> },
    { key: 'jobs', label: 'Jobs', icon: <Play className="w-4 h-4" /> },
    { key: 'shell', label: 'Remote Shell', icon: <Terminal className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/agents" className="p-2 rounded-lg hover:bg-surface-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-surface-400" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <span className={`status-${agent.status as string}`} />
              <h1 className="text-2xl font-bold text-white">{agent.hostname as string}</h1>
              <span className="text-2xl">{getOsIcon(agent.os as string)}</span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-surface-400">
              <span>{(agent.ip_address as string) ?? 'N/A'}</span>
              <span>v{agent.agent_version as string}</span>
              <span>Last seen: {agent.last_seen ? formatRelativeTime(agent.last_seen as string) : 'Never'}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRunScript(true)}
            disabled={!isOnline}
            className="btn-primary btn-sm"
          >
            <Play className="w-4 h-4" /> Run Script
          </button>
          <button
            onClick={() => setShowShell(!showShell)}
            disabled={!isOnline}
            className="btn-secondary btn-sm"
          >
            <Terminal className="w-4 h-4" /> Shell
          </button>
          <button onClick={handleReboot} disabled={!isOnline} className="btn-secondary btn-sm">
            <RefreshCw className="w-4 h-4" /> Reboot
          </button>
          <button onClick={handleShutdown} disabled={!isOnline} className="btn-danger btn-sm">
            <Power className="w-4 h-4" /> Shutdown
          </button>
          <button onClick={handleDelete} className="btn-ghost btn-sm text-red-400 hover:text-red-300">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-700 pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors',
              activeTab === tab.key
                ? 'text-brand-400 border-b-2 border-brand-400 bg-surface-800/50'
                : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/30'
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab agent={agent} latestMetric={latestMetric} />
      )}
      {activeTab === 'metrics' && (
        <MetricsTab metrics={metrics} />
      )}
      {activeTab === 'inventory' && (
        <InventoryTab inventory={inventory} />
      )}
      {activeTab === 'jobs' && (
        <JobsTab agentId={agentId} />
      )}
      {activeTab === 'shell' && (
        <RemoteShellPanel agentId={agentId} isOnline={isOnline} />
      )}

      {/* Dialogs */}
      {showRunScript && (
        <RunScriptDialog
          agentId={agentId}
          onClose={() => setShowRunScript(false)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Overview Tab
// ═══════════════════════════════════════════════════════════════

function OverviewTab({ agent, latestMetric }: { agent: Record<string, unknown>; latestMetric?: Record<string, unknown> }) {
  const cpuUsage = (latestMetric?.cpu_usage_percent as number) ?? 0;
  const ramUsed = (latestMetric?.ram_used_bytes as number) ?? 0;
  const ramTotal = (latestMetric?.ram_total_bytes as number) ?? 1;
  const ramPercent = Math.round((ramUsed / ramTotal) * 100);
  const diskUsed = (latestMetric?.disk_used_bytes as number) ?? 0;
  const diskTotal = (latestMetric?.disk_total_bytes as number) ?? 1;
  const diskPercent = Math.round((diskUsed / diskTotal) * 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* System Metrics */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className="text-sm font-medium text-surface-400 uppercase tracking-wider">Real-time Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            icon={<Cpu className="w-5 h-5 text-brand-400" />}
            label="CPU Usage"
            value={`${cpuUsage.toFixed(1)}%`}
            percent={cpuUsage}
            color="brand"
          />
          <MetricCard
            icon={<MemoryStick className="w-5 h-5 text-purple-400" />}
            label="RAM Usage"
            value={`${formatBytes(ramUsed)} / ${formatBytes(ramTotal)}`}
            percent={ramPercent}
            color="purple"
          />
          <MetricCard
            icon={<HardDrive className="w-5 h-5 text-cyan-400" />}
            label="Disk Usage"
            value={`${formatBytes(diskUsed)} / ${formatBytes(diskTotal)}`}
            percent={diskPercent}
            color="cyan"
          />
        </div>

        {latestMetric && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 text-surface-400 text-xs mb-1">
                <Download className="w-3.5 h-3.5" /> Network RX
              </div>
              <p className="text-white font-medium">{formatBytes((latestMetric.net_rx_bytes as number) ?? 0)}/s</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-surface-400 text-xs mb-1">
                <Upload className="w-3.5 h-3.5" /> Network TX
              </div>
              <p className="text-white font-medium">{formatBytes((latestMetric.net_tx_bytes as number) ?? 0)}/s</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-surface-400 text-xs mb-1">
                <Activity className="w-3.5 h-3.5" /> Processes
              </div>
              <p className="text-white font-medium">{(latestMetric.process_count as number) ?? 0}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-surface-400 text-xs mb-1">
                <Clock className="w-3.5 h-3.5" /> Uptime
              </div>
              <p className="text-white font-medium">{formatDuration((latestMetric.uptime_sec as number) ?? 0)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Agent Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-surface-400 uppercase tracking-wider">Agent Information</h3>
        <div className="card p-4 space-y-3">
          <InfoRow label="Agent ID" value={(agent.id as string).slice(0, 8) + '…'} mono />
          <InfoRow label="Hostname" value={agent.hostname as string} />
          <InfoRow label="OS" value={`${getOsIcon(agent.os as string)} ${agent.os_version ?? agent.os}`} />
          <InfoRow label="IP Address" value={(agent.ip_address as string) ?? 'N/A'} mono />
          <InfoRow label="Version" value={`v${agent.agent_version as string}`} />
          <InfoRow label="Enrolled" value={new Date(agent.enrolled_at as string).toLocaleDateString()} />
          <InfoRow label="Source" value={agent.source as string} />
        </div>

        <h3 className="text-sm font-medium text-surface-400 uppercase tracking-wider">Capabilities</h3>
        <div className="card p-4">
          <div className="flex flex-wrap gap-2">
            {((agent.capabilities as string[]) ?? []).map((cap) => (
              <span key={cap} className="badge-info text-xs">{cap}</span>
            ))}
            {((agent.capabilities as string[]) ?? []).length === 0 && (
              <span className="text-surface-500 text-sm">No capabilities reported</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, percent, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  percent: number;
  color: string;
}) {
  const barColor = percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-yellow-500' : `bg-${color}-500`;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-surface-400 text-sm">{label}</span>
      </div>
      <p className="text-white text-lg font-semibold mb-2">{value}</p>
      <div className="w-full bg-surface-700 rounded-full h-1.5">
        <div
          className={cn('h-1.5 rounded-full transition-all duration-500', barColor)}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-surface-400 text-sm">{label}</span>
      <span className={cn('text-white text-sm', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Metrics Tab
// ═══════════════════════════════════════════════════════════════

function MetricsTab({ metrics }: { metrics: Array<Record<string, unknown>> }) {
  if (metrics.length === 0) {
    return (
      <div className="card p-12 text-center">
        <Activity className="w-12 h-12 mx-auto text-surface-600 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No metrics data</h3>
        <p className="text-surface-400 text-sm">Metrics will appear once the agent starts reporting</p>
      </div>
    );
  }

  // Simple sparkline rendering with SVG
  const renderSparkline = (data: number[], color: string) => {
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const width = 300;
    const height = 60;
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    );
  };

  const cpuData = metrics.map(m => (m.cpu_usage_percent as number) ?? 0).reverse();
  const ramData = metrics.map(m => {
    const used = (m.ram_used_bytes as number) ?? 0;
    const total = (m.ram_total_bytes as number) ?? 1;
    return (used / total) * 100;
  }).reverse();
  const netRxData = metrics.map(m => (m.net_rx_bytes as number) ?? 0).reverse();
  const netTxData = metrics.map(m => (m.net_tx_bytes as number) ?? 0).reverse();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-surface-300 font-medium text-sm">CPU Usage (%)</span>
          <span className="text-brand-400 font-mono text-sm">{cpuData[cpuData.length - 1]?.toFixed(1)}%</span>
        </div>
        {renderSparkline(cpuData, '#3B82F6')}
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-surface-300 font-medium text-sm">RAM Usage (%)</span>
          <span className="text-purple-400 font-mono text-sm">{ramData[ramData.length - 1]?.toFixed(1)}%</span>
        </div>
        {renderSparkline(ramData, '#A855F7')}
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-surface-300 font-medium text-sm">Network RX (bytes/s)</span>
          <span className="text-cyan-400 font-mono text-sm">{formatBytes(netRxData[netRxData.length - 1] ?? 0)}/s</span>
        </div>
        {renderSparkline(netRxData, '#06B6D4')}
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-surface-300 font-medium text-sm">Network TX (bytes/s)</span>
          <span className="text-green-400 font-mono text-sm">{formatBytes(netTxData[netTxData.length - 1] ?? 0)}/s</span>
        </div>
        {renderSparkline(netTxData, '#22C55E')}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Inventory Tab
// ═══════════════════════════════════════════════════════════════

function InventoryTab({ inventory }: { inventory?: Record<string, unknown> }) {
  if (!inventory) {
    return (
      <div className="card p-12 text-center">
        <Package className="w-12 h-12 mx-auto text-surface-600 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No inventory data</h3>
        <p className="text-surface-400 text-sm">Inventory snapshot will appear once the agent reports</p>
      </div>
    );
  }

  const snapshot = (inventory.snapshot_data ?? inventory) as Record<string, unknown>;
  const os = snapshot.os as Record<string, unknown> | undefined;
  const hardware = snapshot.hardware as Record<string, unknown> | undefined;
  const software = (snapshot.software ?? []) as Array<Record<string, unknown>>;
  const services = (snapshot.services ?? []) as Array<Record<string, unknown>>;
  const users = (snapshot.users ?? []) as Array<Record<string, unknown>>;
  const networkInterfaces = (snapshot.network_interfaces ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      {/* OS Info */}
      {os && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4" /> Operating System
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoBlock label="Name" value={os.name as string} />
            <InfoBlock label="Version" value={os.version as string} />
            <InfoBlock label="Arch" value={os.arch as string} />
            <InfoBlock label="Kernel" value={(os.kernel_version as string) ?? 'N/A'} />
          </div>
        </div>
      )}

      {/* Hardware */}
      {hardware && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4" /> Hardware
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoBlock label="CPU" value={hardware.cpu_model as string} />
            <InfoBlock label="Cores" value={String(hardware.cpu_cores ?? 'N/A')} />
            <InfoBlock label="RAM" value={formatBytes((hardware.total_ram_bytes as number) ?? 0)} />
            <InfoBlock label="Manufacturer" value={(hardware.manufacturer as string) ?? 'N/A'} />
          </div>
        </div>
      )}

      {/* Network Interfaces */}
      {networkInterfaces.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Network className="w-4 h-4" /> Network Interfaces
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-surface-400 text-xs uppercase">
                  <th className="text-left py-2 px-3">Name</th>
                  <th className="text-left py-2 px-3">IP Address</th>
                  <th className="text-left py-2 px-3">MAC</th>
                  <th className="text-left py-2 px-3">Speed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {networkInterfaces.map((iface, i) => (
                  <tr key={i} className="text-surface-300">
                    <td className="py-2 px-3 font-medium text-white">{iface.name as string}</td>
                    <td className="py-2 px-3 font-mono text-xs">{iface.ip_address as string}</td>
                    <td className="py-2 px-3 font-mono text-xs">{iface.mac_address as string}</td>
                    <td className="py-2 px-3">{(iface.speed as string) ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Installed Software */}
      {software.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" /> Installed Software ({software.length})
          </h3>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-850">
                <tr className="text-surface-400 text-xs uppercase">
                  <th className="text-left py-2 px-3">Name</th>
                  <th className="text-left py-2 px-3">Version</th>
                  <th className="text-left py-2 px-3">Publisher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {software.map((sw, i) => (
                  <tr key={i} className="text-surface-300">
                    <td className="py-1.5 px-3 text-white">{sw.name as string}</td>
                    <td className="py-1.5 px-3 text-xs">{(sw.version as string) ?? 'N/A'}</td>
                    <td className="py-1.5 px-3 text-xs">{(sw.publisher as string) ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Services */}
      {services.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" /> Services ({services.length})
          </h3>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-850">
                <tr className="text-surface-400 text-xs uppercase">
                  <th className="text-left py-2 px-3">Name</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Start Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {services.map((svc, i) => (
                  <tr key={i} className="text-surface-300">
                    <td className="py-1.5 px-3 text-white">{(svc.display_name ?? svc.name) as string}</td>
                    <td className="py-1.5 px-3">
                      <span className={cn('text-xs', svc.status === 'running' ? 'text-green-400' : 'text-surface-500')}>
                        {svc.status as string}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-xs">{(svc.start_type as string) ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users */}
      {users.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> Local Users ({users.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {users.map((u, i) => (
              <span key={i} className="badge-neutral text-sm">
                {u.username as string}
                {Boolean(u.is_admin) && <Shield className="w-3 h-3 inline ml-1 text-yellow-400" />}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-surface-500 text-xs uppercase">{label}</p>
      <p className="text-white text-sm font-medium truncate">{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Jobs Tab
// ═══════════════════════════════════════════════════════════════

function JobsTab({ agentId }: { agentId: string }) {
  const { data, isLoading } = useJobs({ agent_id: agentId });
  const jobs = (data?.data ?? []) as Array<Record<string, unknown>>;

  if (isLoading) {
    return <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full" /></div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="card p-12 text-center">
        <Play className="w-12 h-12 mx-auto text-surface-600 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No jobs for this agent</h3>
        <p className="text-surface-400 text-sm">Run a script or command to create a job</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-700 bg-surface-800/50">
            <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase">Status</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase">Type</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase">Created</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase">Duration</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-surface-400 uppercase">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-700/50">
          {jobs.map((job) => (
            <tr key={job.id as string} className="hover:bg-surface-800/50">
              <td className="py-3 px-4">
                <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getStatusBadge(job.status as string))}>
                  {job.status as string}
                </span>
              </td>
              <td className="py-3 px-4 text-white text-sm font-mono">{job.type as string}</td>
              <td className="py-3 px-4 text-surface-400 text-sm">{formatRelativeTime(job.created_at as string)}</td>
              <td className="py-3 px-4 text-surface-400 text-sm">
                {job.completed_at
                  ? formatDuration(Math.round((new Date(job.completed_at as string).getTime() - new Date(job.created_at as string).getTime()) / 1000))
                  : '—'
                }
              </td>
              <td className="py-3 px-4 text-surface-400 text-sm truncate max-w-[200px]">
                {(job.exit_code !== undefined && job.exit_code !== null) ? `Exit: ${job.exit_code}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
