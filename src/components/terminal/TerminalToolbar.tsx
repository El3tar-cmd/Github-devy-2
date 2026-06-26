import { Play, Square, RefreshCw, Terminal as TerminalIcon, AlertCircle, Cpu, Wifi, WifiOff, X } from 'lucide-react';
import type { ConnectionStatus } from './useTerminalConnection';

interface TerminalToolbarProps {
  workspaceId: string;
  // View / execution mode
  viewMode: 'interactive' | 'logs';
  setViewMode: (mode: 'interactive' | 'logs') => void;
  executionMode: 'http' | 'ws';
  setExecutionMode: React.Dispatch<React.SetStateAction<'http' | 'ws'>>;
  // Connection
  connectionStatus: ConnectionStatus;
  reconnectAttempts: number;
  // Error
  error: string | null;
  setError: (err: string | null) => void;
  // Tabs
  tabs: string[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  addTab: () => void;
  removeTab: (tabId: string, e: React.MouseEvent) => void;
  // Processes modal
  onOpenProcesses: () => void;
  // Command form
  command: string;
  setCommand: (cmd: string) => void;
  isRunning: boolean;
  handleSendCommand: (e: React.FormEvent) => void;
  // Quick actions
  sendSpecial: (keys: string) => void;
  runPreset: (cmd: string) => void;
}

export function TerminalToolbar({
  workspaceId,
  viewMode,
  setViewMode,
  executionMode,
  setExecutionMode,
  connectionStatus,
  reconnectAttempts,
  error,
  setError,
  tabs,
  activeTabId,
  setActiveTabId,
  addTab,
  removeTab,
  onOpenProcesses,
  command,
  setCommand,
  isRunning,
  handleSendCommand,
  sendSpecial,
  runPreset,
}: TerminalToolbarProps) {
  return (
    <>
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

            {/* Active Processes Trigger */}
            <button
              type="button"
              onClick={onOpenProcesses}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer"
              title="إدارة العمليات الجارية وإنهائها"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>العمليات الجارية</span>
            </button>
         </div>
      </div>

      {/* Terminal Tabs Bar */}
      <div className="mb-2 flex items-center justify-between gap-2 bg-[#101016]/60 border border-white/5 rounded-xl p-1.5 overflow-x-auto scrollbar-thin">
        <div className="flex items-center gap-1">
          {tabs.map((tabId) => (
            <div
              key={tabId}
              onClick={() => setActiveTabId(tabId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg cursor-pointer transition-all border ${
                activeTabId === tabId
                  ? 'bg-sky-500/15 text-sky-400 border-sky-500/35 shadow-sm shadow-sky-500/5'
                  : 'text-slate-400 hover:text-slate-200 bg-transparent border-transparent hover:bg-white/5'
              }`}
            >
              <TerminalIcon className={`w-3.5 h-3.5 ${activeTabId === tabId ? 'text-sky-400' : 'text-slate-500'}`} />
              <span>Bash #{tabId}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => removeTab(tabId, e)}
                  className="p-0.5 hover:bg-white/10 rounded text-slate-500 hover:text-rose-400 transition-colors"
                  title="إغلاق الطرفية"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addTab}
            className="p-1.5 px-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-mono transition-colors border border-white/5 flex items-center gap-1 shrink-0"
            title="فتح طرفية جديدة"
          >
            <span>+</span>
            <span className="text-[10px] font-sans">جديد</span>
          </button>
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
    </>
  );
}

interface TerminalFooterProps {
  command: string;
  setCommand: (cmd: string) => void;
  isRunning: boolean;
  handleSendCommand: (e: React.FormEvent) => void;
  sendSpecial: (keys: string) => void;
  runPreset: (cmd: string) => void;
}

export function TerminalFooter({
  command,
  setCommand,
  isRunning,
  handleSendCommand,
  sendSpecial,
  runPreset,
}: TerminalFooterProps) {
  return (
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
  );
}
