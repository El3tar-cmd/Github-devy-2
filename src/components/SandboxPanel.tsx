import { useState, useEffect, useMemo } from "react";
import { 
  ShieldAlert, 
  Terminal, 
  Send, 
  Trash2, 
  RefreshCw, 
  Play, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronRight,
  Database,
  Code
} from "lucide-react";

interface SandboxLog {
  id: string;
  provider: 'stripe' | 'twilio' | 'auth0' | 'webhook';
  method: string;
  path: string;
  body: any;
  query: any;
  headers: any;
  timestamp: number;
  response: any;
}

export function SandboxPanel() {
  const [logs, setLogs] = useState<SandboxLog[]>([]);
  const [filter, setFilter] = useState<'all' | 'stripe' | 'twilio' | 'auth0' | 'webhook'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
  // Webhook Simulator state
  const [webhookUrl, setWebhookUrl] = useState("http://localhost:3000/api/webhooks/stripe");
  const [eventType, setEventType] = useState("payment_intent.succeeded");
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<any | null>(null);

  // Poll logs
  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/sandbox/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error("Failed to fetch sandbox logs", e);
    }
  };

  const clearLogs = async () => {
    try {
      const res = await fetch("/api/sandbox/clear", { method: "POST" });
      if (res.ok) {
        setLogs([]);
        setExpandedLogId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerWebhook = async () => {
    if (!webhookUrl.trim() || triggering) return;
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/sandbox/trigger-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl, eventType })
      });
      const data = await res.json();
      setTriggerResult(data);
      fetchLogs();
    } catch (err: any) {
      setTriggerResult({ error: err.message });
    } finally {
      setTriggering(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter(log => log.provider === filter);
  }, [logs, filter]);

  // Hostname helper for config urls
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:9876";

  return (
    <div className="flex flex-col lg:flex-row h-full bg-[#0a0a0d] text-slate-300 overflow-hidden font-sans select-none">
      
      {/* Webhook simulator & endpoints info (Left) */}
      <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-white/5 bg-[#0f0f14] flex flex-col shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-white/5 flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white uppercase tracking-wider">API Mocking Configurations</span>
        </div>

        {/* Configuration details */}
        <div className="p-4 space-y-4 border-b border-white/5">
          <h3 className="text-[10px] text-slate-500 font-bold uppercase">Sandbox SDK Base URLs</h3>
          <div className="space-y-3">
            {/* Stripe endpoint */}
            <div className="p-2.5 rounded-lg bg-[#161620] border border-white/5 text-[10px] font-mono space-y-1 select-text">
              <span className="text-white font-bold block">STRIPE API BASE</span>
              <span className="text-slate-400 block truncate">{currentOrigin}/api/sandbox/stripe</span>
            </div>

            {/* Twilio endpoint */}
            <div className="p-2.5 rounded-lg bg-[#161620] border border-white/5 text-[10px] font-mono space-y-1 select-text">
              <span className="text-white font-bold block">TWILIO MESSAGE ENDPOINT</span>
              <span className="text-slate-400 block truncate">{currentOrigin}/api/sandbox/twilio</span>
            </div>

            {/* Auth0 endpoint */}
            <div className="p-2.5 rounded-lg bg-[#161620] border border-white/5 text-[10px] font-mono space-y-1 select-text">
              <span className="text-white font-bold block">AUTH0 OAUTH DOMAIN</span>
              <span className="text-slate-400 block truncate">{currentOrigin}/api/sandbox/auth0</span>
            </div>
          </div>
        </div>

        {/* Webhook Trigger Simulator */}
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase">Webhook Simulator</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Webhook Target URL</label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="e.g. http://localhost:3000/webhooks"
                className="w-full bg-[#161620] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Event Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full bg-[#161620] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="payment_intent.succeeded">payment_intent.succeeded</option>
                <option value="payment_intent.payment_failed">payment_intent.payment_failed</option>
                <option value="customer.subscription.created">customer.subscription.created</option>
                <option value="customer.subscription.deleted">customer.subscription.deleted</option>
                <option value="custom.event.mocked">custom.event.mocked</option>
              </select>
            </div>

            <button
              onClick={handleTriggerWebhook}
              disabled={triggering || !webhookUrl.trim()}
              className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {triggering ? "Firing Webhook..." : <>
                <Play className="w-3.5 h-3.5 fill-current" /> Fire Webhook Event
              </>}
            </button>

            {/* Trigger Response */}
            {triggerResult && (
              <div className="p-3 bg-[#0a0a0e] rounded-lg border border-white/5 space-y-1.5 select-text font-mono">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Last webhook outcome</span>
                {triggerResult.error ? (
                  <span className="text-[10px] text-rose-400 block">{triggerResult.error}</span>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Response Status:</span>
                      <span className={`font-bold ${
                        triggerResult.response.status >= 200 && triggerResult.response.status < 300
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}>
                        {triggerResult.response.status} {triggerResult.response.statusText}
                      </span>
                    </div>
                    <pre className="text-[9px] text-slate-400 p-1.5 bg-[#14141c] rounded max-h-24 overflow-y-auto overflow-x-hidden whitespace-pre-wrap">
                      {JSON.stringify(triggerResult.response.body, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Captured Logs View (Right) */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#07070a]">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-white/5 bg-[#0e0e13] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Sandbox Mock Logs</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Filters */}
            <div className="flex bg-[#161620] border border-white/10 rounded-lg p-0.5 text-[10px] font-mono">
              {(['all', 'stripe', 'twilio', 'auth0', 'webhook'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setFilter(p)}
                  className={`px-2 py-1 rounded transition-colors uppercase cursor-pointer ${
                    filter === p ? 'bg-emerald-500 text-black font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={clearLogs}
              disabled={logs.length === 0}
              className="p-1.5 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 rounded-md transition-all disabled:opacity-35"
              title="Clear Logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Logs list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-3 border border-dashed border-white/5 rounded-2xl bg-[#0d0d12]">
              <ShieldAlert className="w-8 h-8 text-slate-600 animate-pulse" />
              <span className="text-xs font-mono text-center max-w-xs">No sandbox mock calls intercepted yet. Run API requests or trigger mock webhooks to populate details.</span>
            </div>
          ) : (
            filteredLogs.map(log => {
              const isExpanded = expandedLogId === log.id;
              
              // Provider color code
              const badgeColors = {
                stripe: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
                twilio: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
                auth0: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                webhook: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              };

              return (
                <div 
                  key={log.id} 
                  className="bg-[#0f0f15] border border-white/5 rounded-lg overflow-hidden transition-all hover:border-white/10"
                >
                  {/* Log Header Row */}
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="p-3 flex items-center justify-between cursor-pointer font-mono select-none"
                  >
                    <div className="flex items-center gap-3 overflow-hidden pr-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${badgeColors[log.provider]}`}>
                        {log.provider}
                      </span>
                      <span className="text-xs font-bold text-white shrink-0">
                        {log.method}
                      </span>
                      <span className="text-xs text-slate-400 truncate font-semibold">
                        {log.path}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-slate-500 hidden sm:inline">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded log details */}
                  {isExpanded && (
                    <div className="p-3.5 border-t border-white/5 bg-[#0a0a0d] space-y-3 divide-y divide-white/5 select-text font-mono text-[10px]">
                      {/* Headers & Params */}
                      <div className="space-y-2">
                        <span className="text-[9px] text-slate-500 font-bold uppercase block">Headers & Query Parameters</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-2 rounded bg-[#101017] border border-white/5 max-h-28 overflow-y-auto">
                            <span className="text-[8px] text-slate-500 block mb-1">Request Headers</span>
                            <pre className="text-purple-300 text-[9px]">{JSON.stringify(log.headers, null, 2)}</pre>
                          </div>
                          <div className="p-2 rounded bg-[#101017] border border-white/5 max-h-28 overflow-y-auto">
                            <span className="text-[8px] text-slate-500 block mb-1">Query Params</span>
                            <pre className="text-blue-300 text-[9px]">{JSON.stringify(log.query, null, 2)}</pre>
                          </div>
                        </div>
                      </div>

                      {/* Request Payload */}
                      <div className="pt-3.5 space-y-1.5">
                        <span className="text-[9px] text-slate-500 font-bold uppercase block">Request Payload (Body)</span>
                        <pre className="p-2.5 rounded bg-[#101017] text-[10px] overflow-x-auto text-slate-300 border border-white/5 max-h-36 overflow-y-auto">
                          {JSON.stringify(log.body, null, 2)}
                        </pre>
                      </div>

                      {/* Response Payload */}
                      <div className="pt-3.5 space-y-1.5">
                        <span className="text-[9px] text-slate-500 font-bold uppercase block">Mock Response Output</span>
                        <pre className="p-2.5 rounded bg-[#07070a] text-[10px] overflow-x-auto text-emerald-400 border border-white/5 max-h-48 overflow-y-auto">
                          {JSON.stringify(log.response, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
