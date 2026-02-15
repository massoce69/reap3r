'use client';

import { useState } from 'react';
import { useCreateJob } from '@/hooks/useApi';
import { X, Play } from 'lucide-react';

interface RunScriptDialogProps {
  agentId: string;
  onClose: () => void;
}

export default function RunScriptDialog({ agentId, onClose }: RunScriptDialogProps) {
  const [language, setLanguage] = useState<'powershell' | 'bash' | 'python' | 'cmd'>('powershell');
  const [script, setScript] = useState('');
  const [workingDir, setWorkingDir] = useState('');
  const [timeoutSec, setTimeoutSec] = useState(300);
  const createJob = useCreateJob();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!script.trim()) return;

    createJob.mutate(
      {
        agent_id: agentId,
        type: 'run_script',
        payload: {
          language,
          script: script.trim(),
          capture_output: true,
          ...(workingDir && { working_dir: workingDir }),
        },
        timeout_sec: timeoutSec,
      },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-surface-850 border border-surface-700 rounded-xl shadow-xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
          <h2 className="text-lg font-semibold text-white">Run Script</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-700 text-surface-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value as typeof language)} className="input">
                <option value="powershell">PowerShell</option>
                <option value="bash">Bash</option>
                <option value="python">Python</option>
                <option value="cmd">CMD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Timeout (seconds)</label>
              <input
                type="number"
                value={timeoutSec}
                onChange={(e) => setTimeoutSec(Number(e.target.value))}
                min={5}
                max={3600}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Working Directory (optional)</label>
            <input
              type="text"
              value={workingDir}
              onChange={(e) => setWorkingDir(e.target.value)}
              className="input"
              placeholder="e.g. C:\Users\admin or /home/user"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Script</label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="input font-mono text-sm resize-none"
              rows={12}
              placeholder={
                language === 'powershell'
                  ? 'Get-Process | Sort-Object CPU -Descending | Select-Object -First 10'
                  : language === 'bash'
                    ? 'top -bn1 | head -20'
                    : language === 'python'
                      ? 'import platform\nprint(platform.uname())'
                      : 'systeminfo | findstr /B /C:"OS"'
              }
              autoFocus
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!script.trim() || createJob.isPending}
              className="btn-primary"
            >
              {createJob.isPending ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Execute
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
