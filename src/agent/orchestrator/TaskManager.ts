export type AgentTaskStatus = "queued" | "running" | "completed" | "error" | "cancelled";
export type AgentTaskKind = "subagent" | "parallel_subagents" | "debug_command";

export interface AgentTask {
  id: string;
  kind: AgentTaskKind;
  title: string;
  status: AgentTaskStatus;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  agentId?: string;
  agentIds?: string[];
  debugSessionId?: string;
  progress?: string;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

const STORAGE_KEY = "agent_background_tasks";

function makeTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function dispatchTaskEvent(name: string, task: AgentTask) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail: task }));
}

export class AgentTaskManager {
  private tasks: Map<string, AgentTask> = new Map();

  constructor() {
    this.restore();
  }

  create(input: Omit<AgentTask, "id" | "startedAt" | "updatedAt" | "status"> & { status?: AgentTaskStatus }) {
    const now = Date.now();
    const task: AgentTask = {
      ...input,
      id: makeTaskId(),
      status: input.status || "running",
      startedAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    this.persist();
    dispatchTaskEvent("agent-task-updated", task);
    return task;
  }

  update(taskId: string, patch: Partial<AgentTask>) {
    const existing = this.tasks.get(taskId);
    if (!existing) return undefined;

    const status = patch.status || existing.status;
    const task: AgentTask = {
      ...existing,
      ...patch,
      status,
      updatedAt: Date.now(),
      completedAt: ["completed", "error", "cancelled"].includes(status) ? (patch.completedAt || existing.completedAt || Date.now()) : patch.completedAt,
    };

    this.tasks.set(taskId, task);
    this.persist();
    dispatchTaskEvent("agent-task-updated", task);
    if (["completed", "error", "cancelled"].includes(task.status) && existing.status !== task.status) {
      dispatchTaskEvent("agent-task-completed", task);
    }
    return task;
  }

  get(taskId: string) {
    return this.tasks.get(taskId);
  }

  list() {
    return Array.from(this.tasks.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  clearCompleted() {
    for (const [id, task] of this.tasks.entries()) {
      if (["completed", "error", "cancelled"].includes(task.status)) {
        this.tasks.delete(id);
      }
    }
    this.persist();
  }

  private persist() {
    if (typeof window === "undefined") return;
    try {
      const serializable = this.list().slice(0, 100).map((task) => ({
        ...task,
        result: typeof task.result === "string" && task.result.length > 20000
          ? `${task.result.slice(0, 20000)}\n...[truncated]`
          : task.result,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch (err) {
      console.warn("Failed to persist background tasks.", err);
    }
  }

  private restore() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const restored = JSON.parse(raw) as AgentTask[];
      for (const task of restored) {
        const status = task.status === "running" || task.status === "queued" ? "error" : task.status;
        this.tasks.set(task.id, {
          ...task,
          status,
          progress: status === "error" ? "Task was interrupted by a page reload or app restart." : task.progress,
          updatedAt: Date.now(),
        });
      }
    } catch (err) {
      console.warn("Failed to restore background tasks.", err);
    }
  }
}

export function getAgentTaskManager() {
  if (typeof window === "undefined") {
    return new AgentTaskManager();
  }

  if (!(window as any).__agentTaskManager) {
    (window as any).__agentTaskManager = new AgentTaskManager();
  }
  return (window as any).__agentTaskManager as AgentTaskManager;
}
