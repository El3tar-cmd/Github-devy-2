import { useState, useRef, useEffect } from 'react';
import { useTerminalConnection } from './useTerminalConnection';
import { useTerminalTabs } from './useTerminalTabs';
import { ProcessManager } from './ProcessManager';
import { TerminalToolbar, TerminalFooter } from './TerminalToolbar';
import 'xterm/css/xterm.css';

interface Props {
  workspaceId: string;
}

export function TerminalUI({ workspaceId }: Props) {
  const [viewMode, setViewMode] = useState<'interactive' | 'logs'>('interactive');
  const [executionMode, setExecutionMode] = useState<'http' | 'ws'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('terminal_execution_mode');
      return (saved === 'http' || saved === 'ws') ? saved : 'ws';
    }
    return 'ws';
  });

  const { tabs, activeTabId, setActiveTabId, addTab, removeTab } = useTerminalTabs(workspaceId);

  const {
    terminalRef,
    wsRef,
    xtermRef,
    connectionStatus,
    reconnectAttempts,
    error,
    setError,
    logContent,
    setLogContent,
  } = useTerminalConnection(workspaceId, activeTabId, executionMode);

  const [showProcessesModal, setShowProcessesModal] = useState(false);
  const [command, setCommand] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Buffer sync
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('terminal_execution_mode', executionMode);
    }
  }, [executionMode]);

  // Command Execution (HTTP / Fallback mode)
  const runCommandHttp = async (cmdToRun: string) => {
    if (isRunning) return;
    setIsRunning(true);
    setError(null);
    const term = xtermRef.current;
    
    const formattedStart = `\r\n$ ${cmdToRun}\r\n`;
    setLogContent(prev => prev + formattedStart);
    if (term) {
      term.write(`\r\n\x1b[1;35m$ ${cmdToRun}\x1b[0m\r\n`);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/cmd/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmdToRun, workspaceId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response stream is unavailable');
      }

      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (value) {
          const text = decoder.decode(value);
          const formatted = text.replace(/(?<!\r)\n/g, '\r\n');
          
          setLogContent(prev => {
            const next = prev + formatted;
            return next.length > 80000 ? '...[Logs truncated to save memory]...\r\n' + next.slice(-60000) : next;
          });
          if (term) {
            term.write(formatted);
          }
        }
        if (done) break;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        const cancelMsg = '\r\n\x1b[1;31m[Process Terminated by User]\x1b[0m\r\n';
        setLogContent(prev => prev + cancelMsg);
        if (term) {
          term.write(cancelMsg);
        }
      } else {
        const errMsg = `\r\n\x1b[91m[Execution Failure: ${err.message}]\x1b[0m\r\n`;
        setLogContent(prev => prev + errMsg);
        if (term) {
          term.write(errMsg);
        }
        setError(err.message);
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const sendSpecial = (keys: string) => {
    if (keys === 'clear') {
      if (xtermRef.current) {
        xtermRef.current.clear();
      }
      setLogContent('=== Terminal Stream Logs ===\r\nBuffer Cleared.\r\n\r\n');
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(keys);
    } else if (keys === '\x03' && isRunning) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    } else {
      setError('Active terminal session is offline. Using HTTP fallback for individual commands.');
    }
  };

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    const cmdToRun = command;
    setCommand('');

    if (executionMode === 'ws' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(cmdToRun + '\r');
    } else {
      runCommandHttp(cmdToRun);
    }
  };

  const runPreset = (commandPreset: string) => {
    if (executionMode === 'ws' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(commandPreset + '\r');
    } else {
      runCommandHttp(commandPreset);
    }
  };

  const cleanLogs = logContent.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

  return (
    <div className="flex-1 bg-[#07070b] flex flex-col relative w-full h-full p-3 overflow-hidden" id="terminal-pane">
      <TerminalToolbar
        workspaceId={workspaceId}
        viewMode={viewMode}
        setViewMode={setViewMode}
        executionMode={executionMode}
        setExecutionMode={setExecutionMode}
        connectionStatus={connectionStatus}
        reconnectAttempts={reconnectAttempts}
        error={error}
        setError={setError}
        tabs={tabs}
        activeTabId={activeTabId}
        setActiveTabId={setActiveTabId}
        addTab={addTab}
        removeTab={removeTab}
        onOpenProcesses={() => setShowProcessesModal(true)}
        command={command}
        setCommand={setCommand}
        isRunning={isRunning}
        handleSendCommand={handleSendCommand}
        sendSpecial={sendSpecial}
        runPreset={runPreset}
      />

      {/* Console Container Sandbox Box */}
      <div className="flex-1 w-full overflow-hidden relative rounded-xl border border-white/5 bg-[#030306] flex flex-col min-h-[220px]" id="terminal-dynamic-sandbox">
        {/* Interactive Xterm.js Canvas Box */}
        <div 
          className={`w-full h-full p-2 flex-1 ${viewMode === 'interactive' ? 'block' : 'hidden'}`}
          style={{ height: 'calc(100% - 10px)' }}
        >
          <div ref={terminalRef} className="w-full h-full overflow-hidden select-text" />
        </div>

        {/* Plain Text Log Renderer */}
        <div className={`w-full h-full p-3.5 flex-1 flex flex-col ${viewMode === 'logs' ? 'flex' : 'hidden'}`} id="terminal-plain-logs-box">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-mono pb-2 border-b border-white/5 mb-3">
            <span>📋 سجل تدفق الطرفية والمدخلات (UTF-8 Stream)</span>
            <button
              type="button"
              onClick={() => sendSpecial('clear')}
              className="text-amber-500 hover:text-amber-400 text-[10px] font-medium tracking-wide transition-colors uppercase"
            >
              Clear Screen [مسح]
            </button>
          </div>
          <pre className="flex-1 w-full overflow-y-auto overflow-x-auto whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed bg-[#0a0a0f]/80 rounded-xl p-3 scrollbar-thin select-text">
            {cleanLogs || 'سجل المخرجات نظيف حالياً. اكتب الأوامر لتبدأ المخرجات بالتدفق هنا.'}
          </pre>
        </div>
      </div>

      <TerminalFooter
        command={command}
        setCommand={setCommand}
        isRunning={isRunning}
        handleSendCommand={handleSendCommand}
        sendSpecial={sendSpecial}
        runPreset={runPreset}
      />

      <ProcessManager
        show={showProcessesModal}
        onClose={() => setShowProcessesModal(false)}
        workspaceId={workspaceId}
        activeTabId={activeTabId}
        onTerminalKilled={setError}
      />
    </div>
  );
}
