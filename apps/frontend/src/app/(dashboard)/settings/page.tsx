'use client';

import { useState } from 'react';
import {
  Settings,
  Key,
  Shield,
  Copy,
  Plus,
  Globe,
  Bell,
  Database,
  Lock,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';

type SettingsTab = 'general' | 'enrollment' | 'security' | 'notifications';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { key: 'enrollment', label: 'Enrollment', icon: <Key className="w-4 h-4" /> },
    { key: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { key: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-surface-400 text-sm mt-1">Configure your MASSVISION Reap3r instance</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="w-48 flex-shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-surface-800 text-white'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'enrollment' && <EnrollmentSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
        </div>
      </div>
    </div>
  );
}

function GeneralSettings() {
  const [orgName, setOrgName] = useState('Default Organization');
  const [timezone, setTimezone] = useState('UTC');
  const [retentionDays, setRetentionDays] = useState(30);

  const handleSave = () => {
    toast.success('Settings saved');
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-brand-400" /> Organization
        </h2>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Organization Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Timezone</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="input">
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
              <option value="Asia/Tokyo">Tokyo</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-cyan-400" /> Data Retention
        </h2>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Metrics Retention (days)
            </label>
            <input
              type="number"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              min={7}
              max={365}
              className="input"
            />
            <p className="text-surface-500 text-xs mt-1">
              Metrics older than this will be automatically purged
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary">
          <Check className="w-4 h-4" /> Save Changes
        </button>
      </div>
    </div>
  );
}

function EnrollmentSettings() {
  const [tokens] = useState([
    {
      id: 'tok_001',
      token: 'ENROLL-DEFAULT-2024-MASSVISION',
      label: 'Default Token',
      created_at: '2024-01-01T00:00:00Z',
      uses: 12,
      max_uses: null,
      expires_at: null,
    }
  ]);

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success('Token copied to clipboard');
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-brand-400" /> Enrollment Tokens
          </h2>
          <button className="btn-primary btn-sm">
            <Plus className="w-4 h-4" /> New Token
          </button>
        </div>

        <div className="space-y-3">
          {tokens.map((tok) => (
            <div key={tok.id} className="flex items-center gap-4 p-4 bg-surface-800/50 rounded-lg border border-surface-700">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">{tok.label}</p>
                <p className="text-surface-400 font-mono text-xs mt-0.5">{tok.token}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500">
                  <span>{tok.uses} uses</span>
                  <span>•</span>
                  <span>{tok.max_uses ? `Max: ${tok.max_uses}` : 'Unlimited'}</span>
                  <span>•</span>
                  <span>{tok.expires_at ? `Expires: ${new Date(tok.expires_at).toLocaleDateString()}` : 'No expiry'}</span>
                </div>
              </div>
              <button
                onClick={() => copyToken(tok.token)}
                className="p-2 rounded-lg hover:bg-surface-700 text-surface-400 transition-colors"
                title="Copy token"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 bg-surface-800/30 rounded-lg border border-surface-700/50">
          <p className="text-surface-400 text-sm font-medium mb-2">Agent Installation Command</p>
          <div className="space-y-2">
            <div>
              <p className="text-surface-500 text-xs mb-1">Windows (PowerShell)</p>
              <code className="block bg-surface-900 rounded p-2 text-xs text-green-300 font-mono">
                irm https://your-domain/install.ps1 | iex -Token &quot;{tokens[0]?.token}&quot;
              </code>
            </div>
            <div>
              <p className="text-surface-500 text-xs mb-1">Linux (Bash)</p>
              <code className="block bg-surface-900 rounded p-2 text-xs text-green-300 font-mono">
                curl -sSL https://your-domain/install.sh | bash -s -- --token &quot;{tokens[0]?.token}&quot;
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecuritySettings() {
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [lockoutMinutes, setLockoutMinutes] = useState(30);
  const [sessionTimeout, setSessionTimeout] = useState(60);
  const [mfaRequired, setMfaRequired] = useState(false);

  const handleSave = () => {
    toast.success('Security settings saved');
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-red-400" /> Authentication
        </h2>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Max Failed Login Attempts
            </label>
            <input
              type="number"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              min={3}
              max={20}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Account Lockout Duration (minutes)
            </label>
            <input
              type="number"
              value={lockoutMinutes}
              onChange={(e) => setLockoutMinutes(Number(e.target.value))}
              min={5}
              max={1440}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Session Timeout (minutes)
            </label>
            <input
              type="number"
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(Number(e.target.value))}
              min={5}
              max={480}
              className="input"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-surface-300">Require MFA</p>
              <p className="text-xs text-surface-500">Two-factor authentication for all users</p>
            </div>
            <button
              onClick={() => setMfaRequired(!mfaRequired)}
              className={`w-11 h-6 rounded-full transition-colors ${
                mfaRequired ? 'bg-brand-500' : 'bg-surface-600'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  mfaRequired ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-400" /> Agent Security
        </h2>
        <div className="space-y-3 max-w-md">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-surface-300">HMAC Envelope Validation</p>
              <p className="text-xs text-surface-500">Verify HMAC-SHA256 signatures on all agent messages</p>
            </div>
            <span className="badge-success text-xs">Enabled</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-surface-300">Anti-Replay (Nonce)</p>
              <p className="text-xs text-surface-500">Reject duplicate nonces within time window</p>
            </div>
            <span className="badge-success text-xs">Enabled</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-surface-300">Time Window Validation</p>
              <p className="text-xs text-surface-500">Reject messages older than 30 seconds</p>
            </div>
            <span className="badge-success text-xs">Enabled</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary">
          <Check className="w-4 h-4" /> Save Changes
        </button>
      </div>
    </div>
  );
}

function NotificationSettings() {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  const handleSave = () => {
    toast.success('Notification settings saved');
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-yellow-400" /> Alert Channels
        </h2>
        <div className="space-y-4 max-w-lg">
          {/* Email */}
          <div className="p-4 bg-surface-800/50 rounded-lg border border-surface-700">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-white">Email Notifications</p>
                <p className="text-xs text-surface-500">Receive alerts via email</p>
              </div>
              <button
                onClick={() => setEmailEnabled(!emailEnabled)}
                className={`w-11 h-6 rounded-full transition-colors ${
                  emailEnabled ? 'bg-brand-500' : 'bg-surface-600'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    emailEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {emailEnabled && (
              <div className="space-y-2">
                <input type="email" className="input" placeholder="admin@example.com" />
                <p className="text-surface-500 text-xs">Separate multiple emails with commas</p>
              </div>
            )}
          </div>

          {/* Webhook */}
          <div className="p-4 bg-surface-800/50 rounded-lg border border-surface-700">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-white">Webhook</p>
                <p className="text-xs text-surface-500">POST JSON to a URL on events</p>
              </div>
              <button
                onClick={() => setWebhookEnabled(!webhookEnabled)}
                className={`w-11 h-6 rounded-full transition-colors ${
                  webhookEnabled ? 'bg-brand-500' : 'bg-surface-600'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    webhookEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {webhookEnabled && (
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="input"
                placeholder="https://hooks.slack.com/services/..."
              />
            )}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Alert Rules</h2>
        <div className="space-y-2 max-w-lg">
          {[
            { label: 'Agent goes offline', enabled: true },
            { label: 'Job failure', enabled: true },
            { label: 'High CPU (>90% for 5min)', enabled: false },
            { label: 'Disk space low (<10%)', enabled: true },
            { label: 'Failed login attempt', enabled: true },
            { label: 'New agent enrolled', enabled: false },
          ].map((rule, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <span className="text-sm text-surface-300">{rule.label}</span>
              <div
                className={`w-9 h-5 rounded-full transition-colors cursor-pointer ${
                  rule.enabled ? 'bg-brand-500' : 'bg-surface-600'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white transition-transform mt-[3px] ${
                    rule.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary">
          <Check className="w-4 h-4" /> Save Changes
        </button>
      </div>
    </div>
  );
}
