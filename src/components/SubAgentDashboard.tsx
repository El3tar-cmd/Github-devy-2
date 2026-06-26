import { useState, useEffect, useCallback } from "react";
import { getAgentTaskManager, AgentTask } from "../agent/orchestrator/TaskManager";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Clock,
  Cpu,
  ListTodo,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";

function formatDuration(startedAt: number, endedAt?: number): string {
  const ms = (endedAt ?? Date.now()) - startedAt;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const STATUS_META: Record<string, { label: string; icon: any; color: string; dot: string }> = {
  queued:    { label: "Queued",    icon: ListTodo,     color: "text-slate-400",  dot: "bg-slate-500" },
  running:   { label: "Running",   icon: CircleDashed, color: "text-blue-400",   dot: "bg-blue-400 animate-pulse" },
  completed: { label: "Done",      icon: CheckCircle2, color: "text-emerald-400", dot: "bg-emerald-400" },
  error:     { label: "Failed",    icon: AlertTriangle, color: "text-rose-400",   dot: "bg-rose-400" },
  cancelled: { label: "Cancelled", icon: XCircle,      color: "text-slate-500",  dot: "bg-slate-600" },
};

function TaskCard({ task }: { task: AgentTask }) {
  const [expanded, setExpanded] = useState(task.status === "running" || task.status === "queued");
  const meta = STATUS_META[task.status] || STATUS_META.error;
  const StatusIcon = meta.icon;
  const isActive = task.status === "running" || task.status === "queued";
  const duration = formatDuration(task.startedAt, task.completedAt);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        "rounded-xl border overflow-hidden transition-colors",
        isActive
          ? "border-blue-500/25 bg-[#0f111a]"
          : task.status === "completed"
          ? "border-emerald-500/15 bg-[#0c110e]"
          : task.status === "error"
          ? "border-rose-500/15 bg-[#110c0c]"
          : "border-white/[0.07] bg-[#0f0f14]"
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        {/* Status dot */}
        <span className={clsx("w-2 h-2 rounded-full mt-1.5 shrink-0", meta.dot)} />

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-100 truncate max-w-[280px]">{task.title}</span>
            <span className={clsx("text-[10px] font-mono uppercase tracking-wide", meta.color)}>
              {meta.label}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[10px] text-slate-500 font-mono flex-wrap">
            {task.agentId && (
              <span className="bg-white/[0.04] border border-white/[0.06] px-1.5 py-px rounded">
                {task.agentId}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(task.startedAt)}
            </span>
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {isActive ? `${duration} elapsed` : duration}
            </span>
          </div>
          {task.progress && (
            <p className="mt-1 text-[11px] text-slate-400 truncate">{task.progress}</p>
          )}
        </div>

        {/* Chevron */}
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-1" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-1" />
        }
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05] pt-3">
              {/* Metadata grid */}
              {task.metadata && Object.keys(task.metadata).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(task.metadata)
                    .filter(([k]) => k !== "requestedTask")
                    .map(([k, v]) => (
                      <div key={k} className="bg-white/[0.03] rounded-lg p-2 border border-white/[0.05]">
                        <div className="text-[9px] uppercase tracking-wide text-slate-500 font-semibold mb-0.5">{k}</div>
                        <div className="text-[11px] text-slate-300 font-mono truncate">{String(v)}</div>
                      </div>
                    ))}
                </div>
              )}

              {/* Requested task */}
              {task.metadata?.requestedTask && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Task</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.05]">
                    {task.metadata.requestedTask}
                  </p>
                </div>
              )}

              {/* Result */}
              {task.result && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-emerald-500 font-semibold mb-1">Result</div>
                  <pre className="text-[10px] font-mono text-emerald-300 bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-2.5 max-h-48 overflow-auto whitespace-pre-wrap break-words">
                    {typeof task.result === "string" ? task.result : JSON.stringify(task.result, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error */}
              {task.error && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-rose-500 font-semibold mb-1">Error</div>
                  <div className="flex gap-2 bg-rose-500/5 border border-rose-500/15 rounded-lg p-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <pre className="text-[10px] font-mono text-rose-300 whitespace-pre-wrap break-words">{task.error}</pre>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function SubAgentDashboard() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [filter, setFilter] = useState<"all" | "running" | "completed" | "error">("all");
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    const mgr = getAgentTaskManager();
    setTasks(mgr.list());
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("agent-task-updated", handler);
    return () => window.removeEventListener("agent-task-updated", handler);
  }, [refresh]);

  // Live duration tick for running tasks
  useEffect(() => {
    const hasRunning = tasks.some(t => t.status === "running" || t.status === "queued");
    if (!hasRunning) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [tasks]);

  const handleClearCompleted = () => {
    getAgentTaskManager().clearCompleted();
    refresh();
  };

  const stats = {
    running: tasks.filter(t => t.status === "running").length,
    queued: tasks.filter(t => t.status === "queued").length,
    completed: tasks.filter(t => t.status === "completed").length,
    error: tasks.filter(t => t.status === "error").length,
    cancelled: tasks.filter(t => t.status === "cancelled").length,
  };

  const filtered = tasks.filter(t => {
    if (filter === "all") return true;
    if (filter === "running") return t.status === "running" || t.status === "queued";
    return t.status === filter;
  });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0d] text-slate-300 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-white/[0.07] bg-[#0e0e13] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
            <Bot className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Sub-Agent Dashboard</h2>
            <p className="text-[10px] text-slate-500 font-mono">Live task monitoring & execution log</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {(stats.completed + stats.error + stats.cancelled) > 0 && (
            <button
              onClick={handleClearCompleted}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium text-slate-400 hover:text-rose-400 border border-white/[0.07] hover:border-rose-500/30 rounded-lg transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear done
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-4 py-2.5 border-b border-white/[0.05] bg-[#0c0c11] flex items-center gap-4 shrink-0 overflow-x-auto">
        {[
          { key: "running", label: "Running", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
          { key: "queued",  label: "Queued",  color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20" },
          { key: "completed", label: "Done",  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { key: "error",   label: "Failed",  color: "text-rose-400",   bg: "bg-rose-500/10 border-rose-500/20" },
        ].map(s => (
          <div key={s.key} className={clsx("flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-mono shrink-0", s.bg)}>
            <Cpu className={clsx("w-3 h-3", s.color)} />
            <span className={clsx("font-bold", s.color)}>{stats[s.key as keyof typeof stats]}</span>
            <span className="text-slate-500">{s.label}</span>
          </div>
        ))}
        <div className="ml-auto text-[10px] text-slate-600 font-mono shrink-0">{tasks.length} total</div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 py-2 border-b border-white/[0.05] flex items-center gap-1 shrink-0">
        {(["all", "running", "completed", "error"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              "px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors",
              filter === f
                ? "bg-white/[0.08] text-white"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]"
            )}
          >
            {f === "running" ? "Active" : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && (
              <span className="ml-1.5 text-[9px] font-mono opacity-70">
                {f === "running"
                  ? stats.running + stats.queued
                  : stats[f as keyof typeof stats]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-600 gap-3 border border-dashed border-white/[0.06] rounded-2xl">
            <Bot className="w-8 h-8 opacity-40" />
            <span className="text-sm">
              {filter === "all" ? "No sub-agent tasks yet." : `No ${filter} tasks.`}
            </span>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
