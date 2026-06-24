import { useEffect, useState } from 'react';
import { RefreshCw, Cpu, X, Terminal as TerminalIcon } from 'lucide-react';
import { AgentTask, getAgentTaskManager } from '../../agent/orchestrator/TaskManager';

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

export function ProcessManager({ show, onClose, workspaceId, activeTabId, onTerminalKilled }: ProcessManagerProps) {
  const [activeProcesses, setActiveProcesses] = useState<ActiveProcesses>({ terminals: [], backgrounds: [] });
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [fetchingProcesses, setFetchingProcesses] = useState(false);

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

  const activeAgentTasks = agentTasks.filter((task) => !['completed', 'error', 'cancelled'].includes(task.status));
  const recentAgentTasks = agentTasks.filter((task) => ['completed', 'error', 'cancelled'].includes(task.status)).slice(0, 5);

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

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-[#171720] border border-white/10 shadow-2xl p-6 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-2 text-rose-400">
            <Cpu className="w-5 h-5 animate-pulse" />
            <h3 className="text-base font-semibold text-white">مراقب وإدارة العمليات (Process Monitor)</h3>
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
          ) : activeProcesses.terminals.length === 0 && activeProcesses.backgrounds.length === 0 && activeAgentTasks.length === 0 && recentAgentTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              لا توجد أي عمليات تفاعلية أو خلفية جارية حالياً.
            </div>
          ) : (
            <>
              {/* Interactive Terminals */}
              {activeProcesses.terminals.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TerminalIcon className="w-3.5 h-3.5" />
                    الطرفيات النشطة (Interactive Shells)
                  </h4>
                  <div className="space-y-2">
                    {activeProcesses.terminals.map((term) => (
                      <div
                        key={term.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#0f0f13] border border-white/5 hover:border-white/10 transition-all animate-in fade-in duration-200"
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
                        <button
                          onClick={() => killProcess('terminal', term.id)}
                          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-black text-rose-400 text-xs font-semibold rounded-lg transition-all border border-rose-500/10 inline-flex items-center gap-1 cursor-pointer"
                          title="إنهاء جلسة الطرفية هذه بالكامل"
                        >
                          <X className="w-3.5 h-3.5" />
                          إنهاء (Kill)
                        </button>
                      </div>
                    ))}
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
                    {activeProcesses.backgrounds.map((bg) => (
                      <div
                        key={bg.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#0f0f13] border border-white/5 hover:border-white/10 transition-all animate-in fade-in duration-200"
                      >
                        <div className="flex flex-col gap-1 flex-1 min-w-0 mr-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded font-mono">PID: {bg.pid}</span>
                          </div>
                          <span className="text-xs text-white font-mono truncate block" title={bg.command}>
                            {bg.command}
                          </span>
                        </div>
                        <button
                          onClick={() => killProcess('background', bg.id)}
                          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-black text-rose-400 text-xs font-semibold rounded-lg transition-all border border-rose-500/10 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                          title="إنهاء هذه العملية الجارية في الخلفية فوراً"
                        >
                          <X className="w-3.5 h-3.5" />
                          إنهاء (Kill)
                        </button>
                      </div>
                    ))}
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

                      return (
                        <div
                          key={task.id}
                          className="p-3 rounded-xl bg-[#0f0f13] border border-white/5 hover:border-white/10 transition-all animate-in fade-in duration-200 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
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
                            <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 border border-white/5 p-2 text-[10px] text-slate-300 font-mono leading-relaxed">
                              {logs.slice(-3000)}
                            </pre>
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
