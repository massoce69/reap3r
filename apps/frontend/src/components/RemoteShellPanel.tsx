'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCreateJob } from '@/hooks/useApi';
import { useWebSocketEvent, useWebSocketSend } from '@/hooks/useWebSocket';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2 } from 'lucide-react';

interface RemoteShellPanelProps {
  agentId: string;
  isOnline: boolean;
}

export default function RemoteShellPanel({ agentId, isOnline }: RemoteShellPanelProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<{ terminal: unknown; fitAddon: unknown } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const createJob = useCreateJob();
  const sendWs = useWebSocketSend();

  // Start remote shell session
  const startSession = useCallback(() => {
    if (!isOnline || isConnecting) return;
    setIsConnecting(true);

    createJob.mutate(
      {
        agent_id: agentId,
        type: 'remote_shell_start',
        payload: {
          shell: 'powershell',
          cols: 120,
          rows: 30,
        },
      },
      {
        onSuccess: (data) => {
          const jobId = (data?.data as Record<string, unknown>)?.id as string;
          setSessionId(jobId);
          setIsConnecting(false);
        },
        onError: () => {
          setIsConnecting(false);
        },
      }
    );
  }, [agentId, isOnline, isConnecting, createJob]);

  // Stop remote shell session
  const stopSession = useCallback(() => {
    if (!sessionId) return;
    createJob.mutate({
      agent_id: agentId,
      type: 'remote_shell_stop',
      payload: { session_id: sessionId },
    });
    setSessionId(null);
  }, [agentId, sessionId, createJob]);

  // Initialize xterm.js
  useEffect(() => {
    if (!termRef.current || terminalInstanceRef.current) return;

    let mounted = true;

    const initTerminal = async () => {
      try {
        const { Terminal } = await import('@xterm/xterm');
        const { FitAddon } = await import('@xterm/addon-fit');
        const { WebLinksAddon } = await import('@xterm/addon-web-links');

        if (!mounted || !termRef.current) return;

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        const terminal = new Terminal({
          cursorBlink: true,
          fontFamily: "'JetBrains Mono', 'Cascadia Code', Menlo, monospace",
          fontSize: 13,
          lineHeight: 1.2,
          theme: {
            background: '#0D1117',
            foreground: '#C9D1D9',
            cursor: '#58A6FF',
            cursorAccent: '#0D1117',
            selectionBackground: '#264F78',
            black: '#0D1117',
            red: '#FF7B72',
            green: '#7EE787',
            yellow: '#D29922',
            blue: '#58A6FF',
            magenta: '#BC8CFF',
            cyan: '#39D2C0',
            white: '#C9D1D9',
            brightBlack: '#484F58',
            brightRed: '#FFA198',
            brightGreen: '#56D364',
            brightYellow: '#E3B341',
            brightBlue: '#79C0FF',
            brightMagenta: '#D2A8FF',
            brightCyan: '#56D4DD',
            brightWhite: '#F0F6FC',
          },
          scrollback: 10000,
          allowProposedApi: true,
        });

        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon);
        terminal.open(termRef.current);
        fitAddon.fit();

        terminal.writeln('\x1b[1;34m╔════════════════════════════════════════════════════╗\x1b[0m');
        terminal.writeln('\x1b[1;34m║\x1b[0m  \x1b[1;36mMASSVISION Reap3r\x1b[0m - Remote Shell                  \x1b[1;34m║\x1b[0m');
        terminal.writeln('\x1b[1;34m╚════════════════════════════════════════════════════╝\x1b[0m');
        terminal.writeln('');
        terminal.writeln('\x1b[33mClick "Connect" to start a remote shell session.\x1b[0m');
        terminal.writeln('');

        // Handle terminal input
        terminal.onData((data: string) => {
          if (sessionId) {
            sendWs({
              action: 'remote_shell_input',
              session_id: sessionId,
              data,
            });
          }
        });

        terminalInstanceRef.current = { terminal, fitAddon };

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
          try {
            fitAddon.fit();
          } catch {
            // ignore
          }
        });
        resizeObserver.observe(termRef.current);

        return () => {
          resizeObserver.disconnect();
        };
      } catch (err) {
        console.error('Failed to initialize terminal:', err);
      }
    };

    initTerminal();

    return () => {
      mounted = false;
      if (terminalInstanceRef.current) {
        (terminalInstanceRef.current.terminal as { dispose: () => void }).dispose();
        terminalInstanceRef.current = null;
      }
    };
  }, [agentId, sessionId, sendWs]);

  // Handle incoming shell output
  useWebSocketEvent('remote_shell.data', (payload) => {
    const p = payload as Record<string, unknown>;
    if (p.agent_id === agentId && p.session_id === sessionId && terminalInstanceRef.current) {
      (terminalInstanceRef.current.terminal as { write: (data: string) => void }).write(p.data as string);
    }
  });

  // Handle session end
  useWebSocketEvent('notification', (payload) => {
    const p = payload as Record<string, unknown>;
    if (p.agent_id === agentId && p.type === 'shell_closed') {
      setSessionId(null);
      if (terminalInstanceRef.current) {
        (terminalInstanceRef.current.terminal as { writeln: (data: string) => void }).writeln(
          '\r\n\x1b[31m[Session ended]\x1b[0m'
        );
      }
    }
  });

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-surface-900' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-850 border border-surface-700 rounded-t-lg">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-medium text-surface-300">Remote Shell</span>
          {sessionId && (
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {!sessionId ? (
            <button
              onClick={startSession}
              disabled={!isOnline || isConnecting}
              className="btn-primary btn-sm"
            >
              {isConnecting ? (
                <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                'Connect'
              )}
            </button>
          ) : (
            <button onClick={stopSession} className="btn-danger btn-sm">
              <X className="w-3.5 h-3.5" /> Disconnect
            </button>
          )}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded hover:bg-surface-700 text-surface-400 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div
        ref={termRef}
        className={`bg-[#0D1117] border border-t-0 border-surface-700 rounded-b-lg overflow-hidden ${
          isFullscreen ? 'flex-1' : 'h-[400px]'
        }`}
      />
    </div>
  );
}
