import { useEffect, useState } from 'react';
import {
  RefreshCw,
  Cpu,
  X,
  Terminal as TerminalIcon,
  Bot,
  Wrench,
  MessageSquare,
  Trash2,
  Search,
  Hammer,
  ShieldCheck,
  Bug,
  ClipboardList,
  SlidersHorizontal,
  Eye,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { AgentTask, getAgentTaskManager } from '../../agent/orchestrator/TaskManager';
import { ChatMessage } from '../../types';

interface ProcessManagerProps {
  show: boolean;
  onClose: () => void;
  workspaceId: string;
  activeTabId: string;
  onTerminalKilled: (message: string) => void;
}

interface ActiveProcesses {
  terminals: Array<{ type: 'terminal'; id: string; workspaceId: string; tabId: string; pid: number }>;
  backgrounds: Array<{ type: 'background'; id: number; pid: number; command: string }>;
}

interface OrchestraAgent {
  id: string;
  displayName: string;
  typeName: string;
  definition: {
    name: string;
    role: string;
    description?: string;
    allowedTools?: string[];
    maxIterations?: number;
    systemPrompt?: string;
  };
  status: 'idle' | 'queued' | 'running' | 'completed' | 'error' | 'cancelled';
  messages: ChatMessage[];
  result?: string;
  currentTask?: string;
  taskId?: string;
  runCount?: number;
  lastError?: string;
  startedAt: number;
  completedAt?: number;
}

export function ProcessManager({ show, onClose, workspaceId, activeTabId, onTerminalKilled }: ProcessManagerProps) {
  const [activeProcesses, setActiveProcesses] = useState<ActiveProcesses>({ terminals: [], backgrounds: [] });
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [orchestraAgents, setOrchestraAgents] = useState<OrchestraAgent[]>([]);
  const [orchestraCapacity, setOrchestraCapacity] = useState<any>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentPanel, setSelectedAgentPanel] = useState<'live' | 'settings'>('live');
  const [fetchingProcesses, setFetchingProcesses] = useState(false);
  
  // Expand/collapse states for cards
  const [expandedTerminals, setExpandedTerminals] = useState<Record<string, boolean>>({});
  const [expandedBackgrounds, setExpandedBackgrounds] = useState<Record<number, boolean>>({});
  const [expandedAgentTasks, setExpandedAgentTasks] = useState<Record<string, boolean>>({});

  const agentVisuals = {
    researcher: { Icon: Search, color: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', shape: 'rounded-full' },
    coder: { Icon: Hammer, color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', shape: 'rounded-lg rotate-45' },
    reviewer: { Icon: ShieldCheck, color: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/30', shape: 'rounded-xl' },
    debugger: { Icon: Bug, color: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/30', shape: 'rounded-md skew-x-6' },
    planner: { Icon: ClipboardList, color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30', shape: 'rounded-sm' },
    default: { Icon: Bot, color: 'text-slate-300', bg: 'bg-slate-500/10', border: 'border-slate-500/30', shape: 'rounded-2xl' },
  };

  const getAgentVisual = (agent: OrchestraAgent) => {
    return agentVisuals[agent.typeName as keyof typeof agentVisuals] || agentVisuals.default;
  };

  const renderAgentMark = (agent: OrchestraAgent, size = 'md') => {
    const visual = getAgentVisual(agent);
    const Icon = visual.Icon;
    const box = size === 'lg' ? 'w-14 h-14' : 'w-9 h-9';
    const icon = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
    return (
      <div className={`${box} ${visual.shape} ${visual.bg} ${visual.border} border flex items-center justify-center shrink-0`}>
        <Icon className={`${icon} ${visual.color} ${visual.shape.includes('rotate') ? '-rotate-45' : ''} ${visual.shape.includes('skew') ? '-skew-x-6' : ''}`} />
      </div>
    );
  };

  const refreshAgentTasks = () => {
    const taskManager = getAgentTaskManager();
    setAgentTasks(
      taskManager
        .list()
        .filter((task) => {
          const taskWorkspaceId = task.metadata?.workspaceId;
          return !taskWorkspaceId || taskWorkspaceId === workspaceId;
        }),
    );

    const orchestrator = (window as any).__agentOrchestrator;
    if (orchestrator) {
      setOrchestraAgents(orchestrator.getAll());
      setOrchestraCapacity(orchestrator.getCapacity?.() || null);
    } else {
      setOrchestraAgents([]);
      setOrchestraCapacity(null);
    }
  };

  const fetchActiveProcesses = async () => {
    setFetchingProcesses(true);
    try {
      const res = await fetch('/api/cmd/active');
      if (res.ok) {
        const data = await res.json();
        setActiveProcesses(data);
      }
    } catch (e) {
      console.error('Error fetching active processes:', e);
    } finally {
      refreshAgentTasks();
      setFetchingProcesses(false);
    }
  };

  const killProcess = async (type: 'terminal' | 'background', id: string | number) => {
    try {
      const res = await fetch('/api/cmd/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      });
      if (res.ok) {
        await fetchActiveProcesses();
        if (type === 'terminal' && id === `${workspaceId}_${activeTabId}`) {
          onTerminalKilled('تم إنهاء جلسة الطرفية الحالية.');
        }
      } else {
        const data = await res.json();
        alert(`فشل إنهاء العملية: ${data.error}`);
      }
    } catch (e: any) {
      alert(`خطأ أثناء محاولة إنهاء العملية: ${e.message}`);
    }
  };

  const cancelAgentTask = async (task: AgentTask) => {
    try {
      const pid = task.metadata?.pid;

      if (task.kind === 'debug_command' && task.debugSessionId && task.status === 'running') {
        const res = await fetch('/api/debug/kill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: task.debugSessionId }),
        });
        if (!res.ok && pid) {
          await killProcess('background', pid);
        }
      } else if (task.kind === 'debug_command' && pid) {
        await killProcess('background', pid);
      }

      if (task.kind === 'subagent' && task.agentId) {
        (window as any).__agentOrchestrator?.killAgent(task.agentId);
      }

      if (task.kind === 'parallel_subagents' && task.agentIds?.length) {
        task.agentIds.forEach((agentId) => (window as any).__agentOrchestrator?.killAgent(agentId));
      }

      getAgentTaskManager().update(task.id, { status: 'cancelled', progress: 'Cancelled from terminal process manager' });
      refreshAgentTasks();
    } catch (e: any) {
      alert(`فشل إلغاء مهمة الوكيل: ${e.message}`);
    }
  };

  const removeAgent = (agent: OrchestraAgent) => {
    try {
      (window as any).__agentOrchestrator?.removeAgent(agent.id, true);
      refreshAgentTasks();
    } catch (e: any) {
      alert(`فشل حذف الوكيل: ${e.message}`);
    }
  };

  const getTaskForAgent = (agent: OrchestraAgent) => {
    return agentTasks.find((task) => task.id === agent.taskId || task.agentId === agent.id);
  };

  const renderAgentTimeline = (agent: OrchestraAgent) => {
    const timeline = agent.messages.slice(-14);
    if (timeline.length === 0) {
      return (
        <div className="rounded-lg border border-white/5 bg-black/20 p-3 text-[11px] text-slate-500">
          Waiting for the first visible model message or tool action.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {timeline.map((msg) => (
          <div key={msg.id} className="rounded-lg border border-white/5 bg-black/20 p-3 space-y-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
              {msg.role === 'assistant' ? <MessageSquare className="w-3 h-3 text-emerald-400" /> : <Wrench className="w-3 h-3 text-sky-400" />}
              <span>{msg.role}</span>
            </div>
            {msg.content && (
              <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-300 font-mono max-h-28 overflow-auto">
                {msg.content.length > 2500 ? `${msg.content.slice(-2500)}` : msg.content}
              </pre>
            )}
            {msg.toolInvocations?.length ? (
              <div className="space-y-2">
                {msg.toolInvocations.map((inv) => (
                  <div key={inv.id} className="rounded-md border border-white/5 bg-[#101016] p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-sky-300 font-mono flex items-center gap-1.5">
                        <Wrench className="w-3 h-3" />
                        {inv.name}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        inv.status === 'success'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : inv.status === 'error'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-amber-500/10 text-amber-300'
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-[10px] text-slate-400 font-mono max-h-24 overflow-auto">
                      {JSON.stringify(inv.args, null, 2)}
                    </pre>
                    {inv.result && (
                      <pre className="mt-2 whitespace-pre-wrap break-words text-[10px] text-slate-300 font-mono max-h-32 overflow-auto border-t border-white/5 pt-2">
                        {inv.result.length > 3000 ? inv.result.slice(-3000) : inv.result}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  const getCurrentAction = (agent: OrchestraAgent, task?: AgentTask) => {
    const lastTool = [...agent.messages]
      .reverse()
      .flatMap((msg) => [...(msg.toolInvocations || [])].reverse())
      .find(Boolean);

    if (lastTool?.status === 'running') return `Using ${lastTool.name}`;
    if (task?.progress) return task.progress;
    if (agent.status === 'queued') return 'Waiting in orchestration queue';
    if (agent.status === 'running') return 'Requesting or processing model response';
    if (agent.lastError) return agent.lastError;
    if (agent.status === 'completed') return 'Completed';
    return 'Idle';
  };

  const renderAgentSettings = (agent: OrchestraAgent) => {
    const tools = agent.definition.allowedTools || [];
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/5 bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Agent Name</div>
            <div className="mt-1 text-sm text-white font-semibold">{agent.displayName}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Task Type</div>
            <div className="mt-1 text-sm text-white font-semibold">{agent.definition.name}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Max Iterations</div>
            <div className="mt-1 text-sm text-slate-200 font-mono">{agent.definition.maxIterations || 'default'}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Runs</div>
            <div className="mt-1 text-sm text-slate-200 font-mono">{agent.runCount || 0}</div>
          </div>
        </div>

        <div className="rounded-lg border border-white/5 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Mission</div>
          <div className="mt-1 text-xs text-slate-200 leading-relaxed">{agent.definition.description || agent.definition.role}</div>
        </div>

        <div className="rounded-lg border border-white/5 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Allowed Tools</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tools.map((tool) => (
              <span key={tool} className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] text-slate-300 font-mono">
                {tool}
              </span>
            ))}
          </div>
        </div>

        {agent.definition.systemPrompt && (
          <div className="rounded-lg border border-white/5 bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Operating Instructions</div>
            <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words text-[10px] text-slate-300 font-mono leading-relaxed">
              {agent.definition.systemPrompt}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const activeAgentTasks = agentTasks.filter((task) => !['completed', 'error', 'cancelled'].includes(task.status));
  const recentAgentTasks = agentTasks.filter((task) => ['completed', 'error', 'cancelled'].includes(task.status)).slice(0, 5);
  const selectedAgent = orchestraAgents.find((agent) => agent.id === selectedAgentId) || orchestraAgents[0];
  const selectedTask = selectedAgent ? getTaskForAgent(selectedAgent) : undefined;

  useEffect(() => {
    if (show) {
      fetchActiveProcesses();
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;

    refreshAgentTasks();
    const onTaskUpdate = () => refreshAgentTasks();
    window.addEventListener('agent-task-updated', onTaskUpdate);
    window.addEventListener('agent-task-completed', onTaskUpdate);
    return () => {
      window.removeEventListener('agent-task-updated', onTaskUpdate);
      window.removeEventListener('agent-task-completed', onTaskUpdate);
    };
  }, [show, workspaceId]);

  useEffect(() => {
    if (!show) return;
    if (orchestraAgents.length === 0) {
      setSelectedAgentId(null);
      return;
    }
    if (!selectedAgentId || !orchestraAgents.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(orchestraAgents[0].id);
    }
  }, [show, orchestraAgents, selectedAgentId]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-7xl rounded-2xl bg-[#171720] border border-white/10 shadow-2xl p-6 flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Cpu className="w-5 h-5 animate-pulse" />
            <h3 className="text-base font-semibold text-white">Sub-Agent Workspace</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 scrollbar-thin pr-1">
          {fetchingProcesses ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-rose-400" />
              <span className="text-xs font-mono">جاري جلب قائمة العمليات الحالية...</span>
            </div>
          ) : activeProcesses.terminals.length === 0 && activeProcesses.backgrounds.length === 0 && orchestraAgents.length === 0 && activeAgentTasks.length === 0 && recentAgentTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              لا توجد أي عمليات تفاعلية أو خلفية جارية حالياً.
            </div>
          ) : (
            <>
              {orchestraAgents.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      Agent Roster & Live Workspace
                    </h4>
                    {orchestraCapacity && (
                      <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 font-mono">
                        <span className="px-2 py-1 rounded bg-white/5">Agents {orchestraCapacity.managedAgents}/{orchestraCapacity.maxAgents}</span>
                        <span className="px-2 py-1 rounded bg-white/5">Running {orchestraCapacity.runningAgents}/{orchestraCapacity.maxConcurrentAgents}</span>
                        <span className="px-2 py-1 rounded bg-white/5">Queued {orchestraCapacity.queuedRuns}</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-3 min-h-[420px]">
                    <div className="rounded-xl bg-[#0f0f13] border border-white/5 overflow-hidden">
                      <div className="px-3 py-2 border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-500">
                        Managed Agents
                      </div>
                      <div className="max-h-[540px] overflow-auto p-2 space-y-2">
                        {orchestraAgents.map((agent) => {
                          const task = getTaskForAgent(agent);
                          const selected = selectedAgent?.id === agent.id;
                          const currentAction = getCurrentAction(agent, task);
                          return (
                            <button
                              key={agent.id}
                              onClick={() => setSelectedAgentId(agent.id)}
                              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                                selected
                                  ? 'bg-emerald-500/10 border-emerald-500/30'
                                  : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-white/[0.03]'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {renderAgentMark(agent)}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-white truncate">{agent.displayName}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                                      agent.status === 'running'
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : agent.status === 'queued'
                                          ? 'bg-amber-500/10 text-amber-300'
                                          : agent.status === 'completed'
                                            ? 'bg-sky-500/10 text-sky-400'
                                            : 'bg-rose-500/10 text-rose-400'
                                    }`}>
                                      {agent.status}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                    <span>{agent.typeName}</span>
                                    {agent.runCount ? <span>runs {agent.runCount}</span> : null}
                                  </div>
                                  <div className="mt-2 text-[11px] text-slate-400 truncate">
                                    {currentAction}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#0f0f13] border border-white/5 min-w-0 overflow-hidden flex flex-col">
                      {selectedAgent ? (
                        <>
                          <div className="p-4 border-b border-white/5 flex items-start justify-between gap-3">
                            <div className="min-w-0 flex items-start gap-3">
                              {renderAgentMark(selectedAgent, 'lg')}
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-base font-semibold text-white truncate">{selectedAgent.displayName}</span>
                                  <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded font-mono">{selectedAgent.typeName}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                    selectedAgent.status === 'running'
                                      ? 'bg-emerald-500/10 text-emerald-400'
                                      : selectedAgent.status === 'queued'
                                        ? 'bg-amber-500/10 text-amber-300'
                                        : selectedAgent.status === 'completed'
                                          ? 'bg-sky-500/10 text-sky-400'
                                          : 'bg-rose-500/10 text-rose-400'
                                  }`}>
                                    {selectedAgent.status}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono break-all">
                                  {selectedAgent.id} {selectedAgent.taskId ? `| ${selectedAgent.taskId}` : ''}
                                </div>
                                <div className="text-xs text-slate-300 break-words">
                                  {selectedAgent.definition.role}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  (window as any).__agentOrchestrator?.killAgent(selectedAgent.id);
                                  refreshAgentTasks();
                                }}
                                disabled={selectedAgent.status !== 'running' && selectedAgent.status !== 'queued'}
                                className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-black disabled:opacity-40 disabled:hover:bg-rose-500/10 disabled:hover:text-rose-400 text-rose-400 text-[11px] font-semibold rounded-lg transition-all border border-rose-500/10 inline-flex items-center gap-1 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                              >
                                <X className="w-3.5 h-3.5" />
                                Stop
                              </button>
                              <button
                                onClick={() => removeAgent(selectedAgent)}
                                className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-semibold rounded-lg transition-all border border-white/5 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove
                              </button>
                            </div>
                          </div>

                          <div className="p-4 space-y-3 overflow-auto">
                            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                              <button
                                onClick={() => setSelectedAgentPanel('live')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors ${
                                  selectedAgentPanel === 'live'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                    : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Live
                              </button>
                              <button
                                onClick={() => setSelectedAgentPanel('settings')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors ${
                                  selectedAgentPanel === 'settings'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                    : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                                }`}
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                Settings
                              </button>
                            </div>

                            {selectedAgentPanel === 'settings' ? (
                              renderAgentSettings(selectedAgent)
                            ) : (
                              <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-slate-500">Current Action</div>
                                <div className="mt-1 text-xs text-emerald-300 font-mono break-words">{getCurrentAction(selectedAgent, selectedTask)}</div>
                              </div>
                              <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-slate-500">Task Status</div>
                                <div className="mt-1 text-xs text-slate-200 font-mono break-words">{selectedTask?.status || selectedAgent.status}</div>
                              </div>
                              <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-slate-500">Task</div>
                                <div className="mt-1 text-xs text-slate-200 break-words">{selectedAgent.currentTask || selectedTask?.title || 'No active task'}</div>
                              </div>
                            </div>

                            <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Visible Chat & Tool Timeline</div>
                              {renderAgentTimeline(selectedAgent)}
                            </div>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="p-6 text-center text-xs text-slate-500">No sub-agent selected.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Terminals */}
              {activeProcesses.terminals.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TerminalIcon className="w-3.5 h-3.5" />
                    الطرفيات النشطة (Interactive Shells)
                  </h4>
                  <div className="space-y-2">
                    {activeProcesses.terminals.map((term) => {
                      const isExpanded = expandedTerminals[term.id] !== false;
                      return (
                        <div
                          key={term.id}
                          className="rounded-xl bg-[#0f0f13] border border-white/5 hover:border-white/10 transition-all animate-in fade-in duration-200 overflow-hidden"
                        >
                          {/* Header - always visible */}
                          <button
                            onClick={() => setExpandedTerminals(prev => ({ ...prev, [term.id]: !prev[term.id] }))}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-white font-mono">Bash #{term.tabId}</span>
                                <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded font-mono">PID: {term.pid}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 truncate max-w-[280px]">
                                Workspace: {term.workspaceId}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </div>
                          </button>
                          
                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="px-3 pb-3 pt-0 border-t border-white/5">
                              <div className="flex items-center justify-between mt-3">
                                <div className="text-[10px] text-slate-500 font-mono">
                                  <div>Workspace ID: {term.workspaceId}</div>
                                  <div>Tab ID: {term.tabId}</div>
                                  <div>Process ID: {term.pid}</div>
                                </div>
                                <button
                                  onClick={() => killProcess('terminal', term.id)}
                                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-black text-rose-400 text-xs font-semibold rounded-lg transition-all border border-rose-500/10 inline-flex items-center gap-1 cursor-pointer"
                                  title="إنهاء جلسة الطرفية هذه بالكامل"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  إنهاء (Kill)
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Background Commands */}
              {activeProcesses.backgrounds.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    عمليات الخلفية (Agent background tasks)
                  </h4>
                  <div className="space-y-2">
                    {activeProcesses.backgrounds.map((bg) => {
                      const isExpanded = expandedBackgrounds[bg.id] !== false;
                      return (
                        <div
                          key={bg.id}
                          className="rounded-xl bg-[#0f0f13] border border-white/5 hover:border-white/10 transition-all animate-in fade-in duration-200 overflow-hidden"
                        >
                          {/* Header - always visible */}
                          <button
                            onClick={() => setExpandedBackgrounds(prev => ({ ...prev, [bg.id]: !prev[bg.id] }))}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex flex-col gap-1 flex-1 min-w-0 mr-3">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded font-mono">PID: {bg.pid}</span>
                              </div>
                              <span className="text-xs text-white font-mono truncate block" title={bg.command}>
                                {bg.command}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </div>
                          </button>
                          
                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="px-3 pb-3 pt-0 border-t border-white/5">
                              <div className="flex items-center justify-between mt-3">
                                <div className="flex-1 min-w-0">
                                  <div className="text-[10px] text-slate-500 font-mono mb-1">Full Command:</div>
                                  <pre className="text-[11px] text-slate-300 font-mono bg-black/20 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">
                                    {bg.command}
                                  </pre>
                                  <div className="text-[10px] text-slate-500 font-mono mt-2">Process ID: {bg.pid}</div>
                                </div>
                                <button
                                  onClick={() => killProcess('background', bg.id)}
                                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-black text-rose-400 text-xs font-semibold rounded-lg transition-all border border-rose-500/10 inline-flex items-center gap-1 shrink-0 cursor-pointer ml-3"
                                  title="إنهاء هذه العملية الجارية في الخلفية فوراً"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  إنهاء (Kill)
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Agent Background Tasks */}
              {(activeAgentTasks.length > 0 || recentAgentTasks.length > 0) && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    مهام الوكيل الخلفية (Agent background tasks)
                  </h4>
                  <div className="space-y-2">
    {[...activeAgentTasks, ...recentAgentTasks].map((task) => {
                      const command = task.metadata?.command;
                      const pid = task.metadata?.pid;
                      const logs = typeof task.result?.logs === 'string' ? task.result.logs : '';
                      const canCancel = task.status === 'running' || task.status === 'queued' || Boolean(pid);
                      const isExpanded = expandedAgentTasks[task.id] !== false;

                      return (
                        <div
                          key={task.id}
                          className="rounded-xl bg-[#0f0f13] border border-white/5 hover:border-white/10 transition-all animate-in fade-in duration-200 overflow-hidden"
                        >
                          {/* Header - always visible */}
                          <button
                            onClick={() => setExpandedAgentTasks(prev => ({ ...prev, [task.id]: !prev[task.id] }))}
                            className="w-full flex items-start justify-between gap-3 p-3 text-left hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded font-mono">
                                  {task.kind}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                  task.status === 'running'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : task.status === 'completed'
                                      ? 'bg-sky-500/10 text-sky-400'
                                      : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                  {task.status}
                                </span>
                                {pid && (
                                  <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded font-mono">
                                    PID: {pid}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-white font-mono truncate block" title={command || task.title}>
                                {command || task.title}
                              </span>
                              <span className="text-[10px] text-slate-500 truncate">
                                {task.progress || task.id}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </div>
                          </button>
                          
                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="px-3 pb-3 pt-0 border-t border-white/5 space-y-3">
                              <div className="flex items-start justify-between gap-3 mt-3">
                                <div className="flex-1 min-w-0 space-y-2">
                                  {command && (
                                    <div>
                                      <div className="text-[10px] text-slate-500 font-mono mb-1">Command:</div>
                                      <pre className="text-[11px] text-slate-300 font-mono bg-black/20 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">
                                        {command}
                                      </pre>
                                    </div>
                                  )}
                                  {pid && (
                                    <div className="text-[10px] text-slate-500 font-mono">Process ID: {pid}</div>
                                  )}
                                  <div className="text-[10px] text-slate-500 font-mono">Task ID: {task.id}</div>
                                </div>
                                <button
                                  onClick={() => cancelAgentTask(task)}
                                  disabled={!canCancel}
                                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-black disabled:opacity-40 disabled:hover:bg-rose-500/10 disabled:hover:text-rose-400 text-rose-400 text-xs font-semibold rounded-lg transition-all border border-rose-500/10 inline-flex items-center gap-1 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                                  title="إلغاء مهمة الوكيل الخلفية"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  إلغاء
                                </button>
                              </div>
                              {logs && (
                                <div>
                                  <div className="text-[10px] text-slate-500 font-mono mb-1">Output Logs:</div>
                                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 border border-white/5 p-2 text-[10px] text-slate-300 font-mono leading-relaxed">
                                    {logs.slice(-3000)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-white/10 flex justify-between items-center text-[10px] text-slate-500">
          <span>* سيؤدي الضغط على "إنهاء" إلى قتل العملية فوراً عبر إرسال إشارة SIGKILL.</span>
          <button
            onClick={fetchActiveProcesses}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg flex items-center gap-1.5 transition-colors border border-white/5 cursor-pointer font-medium"
          >
            <RefreshCw className="w-3 h-3" /> تحديث القائمة
          </button>
        </div>
      </div>
    </div>
  );
}
