import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface Props {
  workspaceId: string;
}

export function TerminalUI({ workspaceId }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isWsOpen, setIsWsOpen] = useState(false);
  
  // Custom enhanced states for dual-fallback rendering
  const [viewMode, setViewMode] = useState<'interactive' | 'logs'>('logs'); // Default to logs which is 100% mobile-friendly
  const [executionMode, setExecutionMode] = useState<'http' | 'ws'>('http'); // Default to HTTP which is bulletproof
  const [logContent, setLogContent] = useState<string>(
    '=== HTTP Terminal Stream Logs ===\r\nType your commands in the helper input box below and click "Run".\r\nOutputs will stream here in real-time, working instantly on mobile and desktop.\r\n\r\n'
  );

  const runCommandHttp = async (cmdToRun: string) => {
    if (isRunning) return;
    setIsRunning(true);
    setError(null);
    const term = xtermRef.current;
    
    // Log the starting message
    const formattedStart = `\r\n$ ${cmdToRun}\r\n`;
    setLogContent(prev => prev + formattedStart);
    if (term) {
      term.write(`\r\n\x1b[35m$ ${cmdToRun}\x1b[0m\r\n`);
    }

    // Cancel any active abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/cmd/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: cmdToRun, workspaceId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (value) {
          const text = decoder.decode(value);
          // Standard UNIX \n needs to be mapped to \r\n for xterm/plain display
          const formatted = text.replace(/(?<!\r)\n/g, '\r\n');
          
          setLogContent(prev => prev + formatted);
          if (term) {
            term.write(formatted);
          }
        }
        if (done) break;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        const cancelMsg = '\r\n[Command cancelled / Process halted]\r\n';
        setLogContent(prev => prev + cancelMsg);
        if (term) {
          term.write('\r\n\x1b[31m[Command cancelled / Process halted]\x1b[0m\r\n');
        }
      } else {
        console.error('HTTP terminal command execution failure:', err);
        const errMsg = `\r\n[Error executing command: ${err.message}]\r\n`;
        setLogContent(prev => prev + errMsg);
        if (term) {
          term.write(`\r\n\x1b[31m[Error executing command: ${err.message}]\x1b[0m\r\n`);
        }
        setError(`Execution error: ${err.message}`);
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const sendSpecial = (keys: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && executionMode === 'ws') {
      wsRef.current.send(keys);
    } else if (keys === '\x03' && isRunning) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    } else if (keys === 'clear') {
      if (xtermRef.current) xtermRef.current.clear();
      setLogContent('=== HTTP Terminal Stream Logs ===\r\nCleared.\r\n\r\n');
    } else {
      setError('Active terminal process can only handle Ctrl+C cancellation in HTTP mode.');
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

  useEffect(() => {
    if (!terminalRef.current) return;
    if (!workspaceId) {
      setError('No workspace selected.');
      return;
    }

    setError(null);
    const term = new Terminal({
      theme: {
        background: '#0b0b0e',
        foreground: '#e2e8f0',
        cursor: '#10b981',
        selectionBackground: '#10b98130',
        black: '#000000',
        red: '#f43f5e',
        green: '#10b981',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#ffffff',
        brightBlack: '#64748b',
        brightRed: '#fb7185',
        brightGreen: '#34d399',
        brightYellow: '#fde047',
        brightBlue: '#60a5fa',
        brightMagenta: '#e879f9',
        brightCyan: '#22d3ee',
        brightWhite: '#f8fafc',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      cursorBlink: true,
      scrollback: 5000,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    try {
      fitAddon.fit();
    } catch (e) {
      console.warn('Terminal first-time container layout fit deferred.', e);
    }
    
    const fitTimer = setTimeout(() => {
      try { fitAddon.fit(); } catch (_) {}
    }, 50);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    let wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${window.location.host}?workspaceId=${workspaceId}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsWsOpen(true);
      term.writeln('\x1b[32m[Terminal Connected (WebSocket Mode)]\x1b[0m');
    };

    ws.onmessage = (event) => {
      const appendText = (text: string) => {
        term.write(text);
        setLogContent(prev => prev + text);
      };

      if (typeof event.data === 'string') {
        appendText(event.data);
      } else {
        event.data.text().then((txt: string) => appendText(txt));
      }
    };

    ws.onerror = () => {
      setIsWsOpen(false);
      term.writeln('\r\n\x1b[33m[WebSocket Offline - Entering HTTP Tunnel Mode]\x1b[0m');
    };

    ws.onclose = () => {
      setIsWsOpen(false);
      term.writeln('\r\n\x1b[33m[Disconnected - Fallback to HTTP Tunnel Mode available]\x1b[0m');
    };

    term.onData(data => {
      if (ws.readyState === WebSocket.OPEN && executionMode === 'ws') {
        ws.send(data);
      }
    });

    const handleResize = () => {
      if (!xtermRef.current) return;
      try { fitAddon.fit(); } catch(e) {}
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(fitTimer);
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [workspaceId, executionMode]);

  // Filter color codes from plain log content to present pristine, readable logs
  const cleanLogs = logContent.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

  return (
    <div className="flex-1 bg-[#0b0b0e] flex flex-col relative w-full h-full p-2 overflow-hidden">
        {error && (
          <div className="absolute top-2 right-2 bg-rose-500/10 text-rose-400 p-2 text-xs rounded border border-rose-500/20 z-50 animate-fade-in flex items-center gap-2">
             <span>{error}</span>
             <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold font-mono">×</button>
          </div>
        )}

        {/* Top Segmented Controls & Configuration Bar */}
        <div className="mb-2 bg-[#121217] border border-white/5 rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-center justify-between">
           <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
             <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Console View:</span>
             <div className="inline-flex rounded-lg p-0.5 bg-[#1e1e24] border border-white/5">
               <button
                 type="button"
                 onClick={() => setViewMode('interactive')}
                 className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                   viewMode === 'interactive' 
                     ? 'bg-emerald-500 text-[#09090b] shadow' 
                     : 'text-slate-400 hover:text-slate-200'
                 }`}
               >
                 Interactive (Bash)
               </button>
               <button
                 type="button"
                 onClick={() => setViewMode('logs')}
                 className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                   viewMode === 'logs' 
                     ? 'bg-emerald-500 text-[#09090b] shadow' 
                     : 'text-slate-400 hover:text-slate-200'
                 }`}
               >
                 Stream Logs (Plain Text) 📱
               </button>
             </div>
           </div>

           <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t border-white/5 pt-2 sm:border-0 sm:pt-0">
             <div className="flex items-center gap-2">
               <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tunnel:</span>
               <div className="inline-flex rounded-lg p-0.5 bg-[#1e1e24] border border-white/5">
                 <button
                   type="button"
                   onClick={() => setExecutionMode('http')}
                   className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                     executionMode === 'http'
                       ? 'bg-amber-500 text-[#09090b] shadow'
                       : 'text-slate-400 hover:text-slate-200'
                   }`}
                   title="Standard HTTP Command Runner (Most Stable)"
                 >
                   HTTP
                 </button>
                 <button
                   type="button"
                   onClick={() => setExecutionMode('ws')}
                   className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                     executionMode === 'ws'
                       ? 'bg-purple-500 text-white shadow'
                       : 'text-slate-400 hover:text-slate-200'
                   }`}
                   title="Real-time WebSockets (Experimental/Buffered)"
                 >
                   WS
                 </button>
               </div>
             </div>

             <div className="shrink-0">
               {isWsOpen ? (
                 <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                   <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                   WS Open
                 </span>
               ) : (
                 <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                   <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                   HTTP Direct
                 </span>
               )}
             </div>
           </div>
        </div>

        {/* Console Container Panel */}
        <div className="flex-1 w-full overflow-hidden relative rounded-xl border border-white/5 bg-[#070709] flex flex-col min-h-[220px]">
           {/* Interactive Xterm.js Canvas Box */}
           <div 
             className={`w-full h-full p-2 flex-1 ${viewMode === 'interactive' ? 'block' : 'hidden'}`}
             style={{ height: 'calc(100% - 10px)' }}
           >
             <div ref={terminalRef} className="w-full h-full overflow-hidden" />
           </div>

           {/* Mobile-Friendly Stream Logs Plain Text Box */}
           <div className={`w-full h-full p-3 flex-1 flex flex-col ${viewMode === 'logs' ? 'block' : 'hidden'}`}>
             <div className="flex items-center justify-between text-slate-500 text-[11px] font-mono pb-2 border-b border-white/5">
                <span>📍 PLAIN LOGGER (TOUCH/COPY OPTIMIZED)</span>
                <button
                  type="button"
                  onClick={() => sendSpecial('clear')}
                  className="text-amber-500 hover:text-amber-400 font-medium tracking-wide transition-colors"
                >
                  [Clear Screen]
                </button>
             </div>
             <pre className="flex-1 w-full mt-2 overflow-y-auto overflow-x-auto whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed bg-black/40 rounded-lg p-3 scrollbar-thin select-text">
               {cleanLogs || 'Cleared. No output logs printed yet.'}
             </pre>
           </div>
        </div>

        {/* Mobile-Friendly Control & Command Input Bar */}
        <div className="mt-2 bg-[#121217] border border-white/5 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-1">
               <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Console Helper</span>
               <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full font-mono">
                 Using {executionMode.toUpperCase()} Tunnel
               </span>
             </div>
            <div className="flex items-center gap-1.5 animate-fade-in">
              <button 
                 type="button"
                 onClick={() => sendSpecial('\x03')}
                 className="px-2.5 py-1 bg-[#1e1e24] text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs font-mono rounded-lg transition-colors border border-rose-500/10 shadow-sm"
                 title="Cancel running process (Ctrl+C)"
              >
                 Ctrl+C
              </button>
              <button 
                 type="button"
                 onClick={() => sendSpecial('\t')}
                 className="px-2.5 py-1 bg-[#1e1e24] text-slate-300 hover:bg-[#2a2a35] text-xs font-mono rounded-lg transition-colors border border-white/5 shadow-sm"
                 title="Tab completion"
              >
                 Tab
              </button>
              <button 
                 type="button"
                 onClick={() => sendSpecial('clear')}
                 className="px-2.5 py-1 bg-[#1e1e24] text-slate-300 hover:bg-[#2a2a35] text-xs font-mono rounded-lg transition-colors border border-white/5 shadow-sm"
                 title="Clear terminal visual buffer"
              >
                 Clear
              </button>
            </div>
          </div>

          <form onSubmit={handleSendCommand} className="flex gap-2">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={isRunning ? "Command is running..." : "Type command to run (e.g. ls -la, npm run build)"}
              disabled={isRunning}
              className="flex-1 bg-[#1a1a22] text-white disabled:opacity-50 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 transition-all border border-white/5 font-mono text-sm placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={!command.trim() || isRunning}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-[#09090b] font-medium px-4 py-2 rounded-xl transition-colors text-sm shrink-0 shadow-lg shadow-emerald-500/10"
            >
              {isRunning ? "Running..." : "Run"}
            </button>
          </form>
          <p className="text-[10px] text-slate-500 leading-normal">
            * Standard commands execute through our stable HTTP stream tunnel instantly. Toggle <span className="text-slate-300 font-mono font-bold">Stream Logs</span> view to copy logs and avoid mobile focus issues.
          </p>
        </div>
    </div>
  );
}
