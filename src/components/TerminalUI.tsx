import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Play, Square, RefreshCw, Terminal as TerminalIcon, AlertCircle, Cpu, Wifi, WifiOff } from 'lucide-react';
import 'xterm/css/xterm.css';

interface Props {
  workspaceId: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export function TerminalUI({ workspaceId }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  // Terminal view configurations
  const [viewMode, setViewMode] = useState<'interactive' | 'logs'>('interactive');
  const [executionMode, setExecutionMode] = useState<'http' | 'ws'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('terminal_execution_mode');
      return (saved === 'http' || saved === 'ws') ? saved : 'ws';
    }
    return 'ws';
  });

  const [logContent, setLogContent] = useState<string>(
    '=== Terminal Stream Logs ===\r\nType commands in the console assistant box or input directly on the terminal canvas.\r\nOutputs are fully synchronized with the host sandbox process in real-time.\r\n\r\n'
  );

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
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(keys);
    } else if (keys === '\x03' && isRunning) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    } else if (keys === 'clear') {
      if (xtermRef.current) {
        xtermRef.current.clear();
      }
      setLogContent('=== HTTP Terminal Stream Logs ===\r\nBuffer Cleared.\r\n\r\n');
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

  // Main Terminal & Multi-tunnel Connection Lifecycle
  useEffect(() => {
    if (!terminalRef.current) return;
    if (!workspaceId) {
      setError('No active developer workspace loaded.');
      return;
    }

    const term = new Terminal({
      theme: {
        background: '#0a0a0f',
        foreground: '#f1f5f9',
        cursor: '#10b981',
        cursorAccent: '#0a0a0f',
        selectionBackground: 'rgba(16, 185, 129, 0.25)',
        black: '#020205',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#ec4899',
        cyan: '#06b6d4',
        white: '#cbd5e1',
        brightBlack: '#64748b',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#f472b6',
        brightCyan: '#22d3ee',
        brightWhite: '#f8fafc',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", "JetBrains Mono", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Direct canvas setup delay to prevent width calculations being 0 during transitions
    const deferredFit = setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (_) {}
    }, 80);

    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isComponentMounted = true;

    const connectWebSocket = () => {
      if (!isComponentMounted) return;

      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProto}//${window.location.host}?workspaceId=${workspaceId}`;
      setConnectionStatus(prev => (prev === 'error' || prev === 'disconnected') ? 'reconnecting' : 'connecting');

      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isComponentMounted) return;
          setConnectionStatus('connected');
          setReconnectAttempts(0);
          setError(null);
          term.write('\r\n\x1b[1;32m● [Terminal Connected Successfully - Realtime WS Mode active]\x1b[0m\r\n');
        };

        ws.onmessage = (event) => {
          if (!isComponentMounted) return;
          const text = event.data;
          if (typeof text === 'string') {
            term.write(text);
            setLogContent(prev => {
              const next = prev + text;
              return next.length > 80000 ? '...[Logs truncated to save memory]...\r\n' + next.slice(-60000) : next;
            });
          }
        };

        ws.onclose = () => {
          if (!isComponentMounted) return;
          setConnectionStatus('disconnected');
          term.write('\r\n\x1b[1;33m⚠️ [Terminal WebSocket disconnected - Switch to HTTP fallbacks or Reconnecting...]\x1b[0m\r\n');
          
          // Exponential backoff reconnect policies under Termux/Sandbox network spikes
          if (reconnectAttempts < 5) {
            const nextDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            setReconnectAttempts(prev => prev + 1);
            reconnectTimer = setTimeout(() => {
              connectWebSocket();
            }, nextDelay);
          } else {
            setConnectionStatus('error');
            setError('Real-time terminal connection persistent drop. Use HTTP manual mode fallback below to write commands.');
          }
        };

        ws.onerror = (e) => {
          console.warn('Sandbox socket connection issue, safe retry scheduled:', e);
        };

      } catch (wsSetupError: any) {
        console.error('Core local host WebSocket binding failed:', wsSetupError);
        if (isComponentMounted) {
          setConnectionStatus('error');
          setError(`WS Bind Error: ${wsSetupError.message}`);
        }
      }
    };

    connectWebSocket();

    // Key inputs directly over terminal characters
    const onDataDisposable = term.onData(data => {
      if (ws && ws.readyState === WebSocket.OPEN && executionMode === 'ws') {
        ws.send(data);
      }
    });

    // Elegant element-level ResizeObserver to handle pane collapses and mobile sliders correctly
    const resizeObserver = new ResizeObserver((entries) => {
      if (!isComponentMounted || !entries || entries.length === 0) return;
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        requestAnimationFrame(() => {
          try {
            fitAddon.fit();
          } catch (_) {}
        });
      }
    });

    if (terminalRef.current && terminalRef.current.parentElement) {
      resizeObserver.observe(terminalRef.current.parentElement);
    }

    return () => {
      isComponentMounted = false;
      clearTimeout(deferredFit);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      onDataDisposable.dispose();
      resizeObserver.disconnect();
      
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        try {
          ws.close();
        } catch (_) {}
      }

      try {
        term.dispose();
      } catch (_) {}

      xtermRef.current = null;
      wsRef.current = null;
    };
  }, [workspaceId]);

  // Quick preset shortcuts
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
        {/* Connection & Status Banner */}
        <div className="mb-2 bg-[#101016]/90 border border-white/5 rounded-xl p-3 flex flex-col lg:flex-row gap-3 items-center justify-between" id="terminal-control-header">
           <div className="flex items-center gap-2.5 w-full lg:w-auto">
             <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
               <TerminalIcon className="w-4 h-4" />
             </div>
             <div>
               <h4 className="text-xs font-semibold text-slate-200">الأطراف التفاعلية (Interactive Shell)</h4>
               <p className="text-[10px] text-slate-500 font-mono">{workspaceId.substring(0, 15)}@sandbox-host</p>
             </div>
           </div>

           <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto lg:justify-end border-t border-white/5 pt-2.5 lg:border-t-0 lg:pt-0">
             {/* Mode Selector */}
             <div className="inline-flex rounded-lg p-0.5 bg-[#171720] border border-white/5 shadow-inner">
               <button
                 type="button"
                 onClick={() => setViewMode('interactive')}
                 className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                   viewMode === 'interactive' 
                     ? 'bg-emerald-500 text-black shadow-sm font-semibold' 
                     : 'text-slate-400 hover:text-slate-200'
                 }`}
               >
                 Terminal (الترمينال)
               </button>
               <button
                 type="button"
                 onClick={() => setViewMode('logs')}
                 className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                   viewMode === 'logs' 
                     ? 'bg-emerald-500 text-black shadow-sm font-semibold' 
                     : 'text-slate-400 hover:text-slate-200'
                 }`}
               >
                 Plain Logs (المخرجات)
               </button>
             </div>

             {/* Connection Status Badge */}
             <div className="flex items-center gap-2 bg-[#171720] border border-white/5 px-2.5 py-1 rounded-lg">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tunnel:</span>
                <button
                  type="button"
                  onClick={() => setExecutionMode(prev => prev === 'ws' ? 'http' : 'ws')}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded font-semibold transition-all ${
                    executionMode === 'ws' ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400'
                  }`}
                  title="اضغط للتبديل بين التوصيل اللحظي (WS) والتدريجي الدائم (HTTP)"
                >
                  {executionMode.toUpperCase()}
                </button>
                <div className="h-3.5 w-[1px] bg-white/5" />
                
                {connectionStatus === 'connected' && (
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    متصل
                  </span>
                )}
                {connectionStatus === 'connecting' && (
                  <span className="flex items-center gap-1.5 text-[10px] text-amber-400 font-medium animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    جاري التوصيل
                  </span>
                )}
                {connectionStatus === 'reconnecting' && (
                   <span className="flex items-center gap-1.5 text-[10px] text-amber-500 font-medium animate-pulse">
                     <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                     إعادة اتصال ({reconnectAttempts}/5)
                   </span>
                )}
                {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
                  <span className="flex items-center gap-1.5 text-[10px] text-rose-400 font-medium">
                    <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                    غير متصل
                  </span>
                )}
             </div>
           </div>
        </div>

        {/* Error Dialog Banner */}
        {error && (
          <div className="mb-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl flex items-center justify-between gap-3 animate-fade-in" id="terminal-error-banner">
             <div className="flex items-center gap-2">
               <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
               <span className="text-xs font-mono">{error}</span>
             </div>
             <button 
               onClick={() => setError(null)} 
               className="text-rose-400 hover:text-white hover:bg-white/5 rounded px-2 py-0.5 text-xs font-bold transition-all shrink-0"
             >
               تجاهل ×
             </button>
          </div>
        )}

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

        {/* Mobile touch targets & smart command shortcut system */}
        <div className="mt-2 bg-[#101016]/80 border border-white/5 rounded-xl p-3 flex flex-col gap-3" id="terminal-control-footer">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
             <div className="flex items-center gap-1.5">
               <Cpu className="w-3.5 h-3.5 text-slate-400" />
               <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">مساعد الكونسول والساند-بوكس</span>
             </div>
             
             {/* Fast Key Helpers */}
             <div className="flex flex-wrap items-center gap-1">
               <button 
                  type="button"
                  onClick={() => runPreset('npm run build')}
                  className="px-2.5 py-1.5 bg-[#171720] hover:bg-[#20202b] text-slate-300 text-[11px] font-mono rounded-lg transition-colors border border-white/5 shadow-sm shrink-0 min-h-[36px]"
                  title="بناء كود الإنتاج والتخريج"
               >
                  Build
               </button>
               <button 
                  type="button"
                  onClick={() => runPreset('npm start')}
                  className="px-2.5 py-1.5 bg-[#171720] hover:bg-[#20202b] text-slate-300 text-[11px] font-mono rounded-lg transition-colors border border-white/5 shadow-sm shrink-0 min-h-[36px]"
                  title="تشغيل في الخلفية"
               >
                  Start
               </button>
               <button 
                  type="button"
                  onClick={() => runPreset('ls -la')}
                  className="px-2.5 py-1.5 bg-[#171720] hover:bg-[#20202b] text-slate-300 text-[11px] font-mono rounded-lg transition-colors border border-white/5 shadow-sm shrink-0 min-h-[36px]"
                  title="استعراض مجلدات المشروع"
               >
                  ls
               </button>
               <div className="w-[1px] h-4 bg-white/5 mx-1" />
               <button 
                  type="button"
                  onClick={() => sendSpecial('\x03')}
                  className="px-2.5 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-black text-[11px] font-mono rounded-lg transition-colors border border-rose-500/10 shadow-sm shrink-0 min-h-[36px]"
                  title="إلغاء العملية الحالية الفعالة (Ctrl+C)"
               >
                  Ctrl+C
               </button>
               <button 
                  type="button"
                  onClick={() => sendSpecial('\t')}
                  className="px-2.5 py-1.5 bg-[#171720] hover:bg-[#20202b] text-slate-200 text-[11px] font-mono rounded-lg transition-colors border border-white/5 shadow-sm shrink-0 min-h-[36px]"
                  title="إكمال تلقائي للسطر"
               >
                  Tab
               </button>
               <button 
                  type="button"
                  onClick={() => sendSpecial('clear')}
                  className="px-2.5 py-1.5 bg-[#171720] hover:bg-[#20202b] text-slate-300 text-[11px] font-mono rounded-lg transition-colors border border-white/5 shadow-sm shrink-0 min-h-[36px]"
                  title="تنظيف شاشة الكونسول"
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
              placeholder={isRunning ? "العملية البرمجية قيد التنفيذ الآن..." : "أدخل الأمر للتنفيذ هنا (مثال: npm install, node test.js)"}
              disabled={isRunning}
              className="flex-1 bg-[#09090c] text-white disabled:opacity-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all border border-white/5 font-mono text-sm placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={!command.trim() || isRunning}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm shrink-0 shadow-lg shadow-emerald-500/10 inline-flex items-center gap-1.5"
            >
              {isRunning ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current animate-pulse" />
                  جاري...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  تنفيذ
                </>
              )}
            </button>
          </form>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center justify-between text-[10px] text-slate-500 leading-relaxed font-sans">
            <span>* يدعم بيئة المطورين Termux وجميع واجهات الهواتف بسلاسة مع الحفاظ على العمليات في الساند بوكس.</span>
            <span>بواسطة Agent-Dev-Framework 2026</span>
          </div>
        </div>
    </div>
  );
}
