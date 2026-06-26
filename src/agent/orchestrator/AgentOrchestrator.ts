import { SubAgentInstance } from "../types/AgentTypes";
import { AGENT_REGISTRY } from "./AgentRegistry";
import { runSubAgent } from "./SubAgentRunner";
import { MessageBus } from "./MessageBus";
import { Settings } from "../../types";
import { getAgentTaskManager } from "./TaskManager";

const MAX_MANAGED_AGENTS = 50;
const DEFAULT_MAX_CONCURRENT_AGENTS = 8;

type QueuedRun = {
  agentId: string;
  start: () => void;
  cancel: () => void;
};

type AgentRunOptions = {
  maxIterations?: number;
  timeoutSeconds?: number;
  onProgress?: (agentId: string, status: string) => void;
  createTaskRecord?: boolean;
};

function makeAgentId(label?: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  if (label) {
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24);
    return `${slug}-${rand}`;
  }
  return `agent-${ts}-${rand}`;
}

function normalizeAgentName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

function deriveAgentName(typeName: string, task?: string) {
  const base = AGENT_REGISTRY[typeName]?.name || "Agent";
  if (!task) return base;

  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "into", "about", "using",
    "implement", "create", "update", "fix", "review", "analyze", "task", "agent",
  ]);
  const words = task
    .replace(/[`"'()[\]{}.,:;!?/\\|<>]+/g, " ")
    .split(/\s+/)
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .slice(0, 4);

  const suffix = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return suffix ? `${base} ${suffix}` : base;
}

export class AgentOrchestrator {
  private activeAgents: Map<string, SubAgentInstance> = new Map();
  private agentNames: Map<string, string> = new Map();
  private messageBus: MessageBus = new MessageBus();
  private abortControllers: Map<string, AbortController> = new Map();
  private queuedRuns: QueuedRun[] = [];
  private runningCount = 0;
  private maxConcurrentAgents: number;

  constructor(maxConcurrentAgents = DEFAULT_MAX_CONCURRENT_AGENTS) {
    this.maxConcurrentAgents = Math.max(1, Math.min(maxConcurrentAgents, MAX_MANAGED_AGENTS));
  }

  createAgent(
    typeName: string,
    displayName?: string,
    overrides?: Partial<Pick<SubAgentInstance, "currentTask">> & {
      systemPrompt?: string;
      maxIterations?: number;
      model?: string;
      temperature?: number;
    }
  ): SubAgentInstance {
    const baseDefinition = AGENT_REGISTRY[typeName];
    if (!baseDefinition) throw new Error(`Unknown agent type: ${typeName}`);
    if (this.activeAgents.size >= MAX_MANAGED_AGENTS) {
      throw new Error(`Cannot create more than ${MAX_MANAGED_AGENTS} managed agents.`);
    }

    const rawName = normalizeAgentName(displayName || deriveAgentName(typeName, overrides?.currentTask));
    let normalizedName = rawName;
    let nameKey = normalizedName.toLowerCase();
    let counter = 2;
    while (this.agentNames.has(nameKey)) {
      normalizedName = `${rawName} ${counter}`;
      nameKey = normalizedName.toLowerCase();
      counter++;
    }

    const definition = {
      ...baseDefinition,
      name: normalizedName,
      systemPrompt: overrides?.systemPrompt || baseDefinition.systemPrompt,
      maxIterations: overrides?.maxIterations || baseDefinition.maxIterations,
      model: overrides?.model || baseDefinition.model,
      temperature: overrides?.temperature ?? baseDefinition.temperature,
    };

    const instance: SubAgentInstance = {
      id: makeAgentId(normalizedName),
      typeName,
      displayName: normalizedName,
      definition,
      status: "idle",
      messages: [],
      currentTask: overrides?.currentTask,
      startedAt: Date.now(),
      runCount: 0,
    };

    this.activeAgents.set(instance.id, instance);
    this.agentNames.set(nameKey, instance.id);
    return instance;
  }

  getCapacity() {
    return {
      maxAgents: MAX_MANAGED_AGENTS,
      managedAgents: this.activeAgents.size,
      maxConcurrentAgents: this.maxConcurrentAgents,
      runningAgents: this.runningCount,
      queuedRuns: this.queuedRuns.length,
    };
  }

  private resolveAgent(agentIdOrName: string) {
    const byId = this.activeAgents.get(agentIdOrName);
    if (byId) return byId;
    const byNameId = this.agentNames.get(agentIdOrName.trim().toLowerCase());
    return byNameId ? this.activeAgents.get(byNameId) : undefined;
  }

  private pumpQueue() {
    while (this.runningCount < this.maxConcurrentAgents && this.queuedRuns.length > 0) {
      const next = this.queuedRuns.shift();
      if (!next) return;
      const instance = this.activeAgents.get(next.agentId);
      if (!instance || instance.status === "cancelled") continue;
      next.start();
    }
  }

  private runManagedAgent(
    instance: SubAgentInstance,
    task: string,
    settings: Settings,
    workspaceId: string,
    toolsSchema: any[],
    executeToolCallFn: any,
    options: AgentRunOptions = {}
  ): Promise<SubAgentInstance> {
    if (instance.status === "running" || instance.status === "queued") {
      throw new Error(`Agent "${instance.displayName}" is already ${instance.status}.`);
    }

    const taskManager = getAgentTaskManager();
    const taskRecord = options.createTaskRecord === false
      ? undefined
      : taskManager.create({
          kind: "subagent",
          title: `${instance.displayName}: ${task}`.slice(0, 160),
          agentId: instance.id,
          metadata: { typeName: instance.typeName, agentName: instance.displayName, requestedTask: task },
          progress: "Queued",
          status: "queued",
        });

    const ac = new AbortController();
    this.abortControllers.set(instance.id, ac);
    instance.status = "queued";
    instance.currentTask = task;
    instance.result = undefined;
    instance.lastError = undefined;
    instance.completedAt = undefined;
    instance.taskId = taskRecord?.id;

    const execute = (resolve: (value: SubAgentInstance) => void) => {
      this.runningCount++;
      instance.status = "running";
      instance.startedAt = Date.now();
      instance.runCount = (instance.runCount || 0) + 1;
      if (taskRecord) taskManager.update(taskRecord.id, { status: "running", progress: "Starting" });

      let timeoutId: any;
      if (options.timeoutSeconds) {
        timeoutId = setTimeout(() => {
          ac.abort();
          instance.status = "error";
          instance.lastError = `Timeout: Sub-agent execution exceeded the limit of ${options.timeoutSeconds} seconds.`;
          instance.result = instance.lastError;
          if (taskRecord) taskManager.update(taskRecord.id, { status: "error", error: instance.lastError, progress: "Timed out" });
          options.onProgress?.(instance.id, "timeout");
        }, options.timeoutSeconds * 1000);
      }

      runSubAgent(
        instance.definition,
        task,
        settings,
        workspaceId,
        toolsSchema,
        executeToolCallFn,
        (status, msgs) => {
          instance.messages = msgs;
          if (taskRecord) {
            taskManager.update(taskRecord.id, {
              progress: status,
              metadata: { ...taskManager.get(taskRecord.id)?.metadata, messageCount: msgs.length },
            });
          }
          options.onProgress?.(instance.id, status);
        },
        ac.signal,
        options.maxIterations
      ).then(({ result, messages }) => {
        if (instance.status === "running") {
          instance.status = "completed";
          instance.result = result;
          instance.messages = messages;
          instance.completedAt = Date.now();
          if (taskRecord) taskManager.update(taskRecord.id, { status: "completed", result, progress: "Completed" });
        }
      }).catch((err: any) => {
        if (instance.status === "running" || instance.status === "queued") {
          instance.status = ac.signal.aborted ? "cancelled" : "error";
          instance.lastError = ac.signal.aborted ? "Cancelled" : `Error: ${err.message}`;
          instance.result = instance.lastError;
          instance.completedAt = Date.now();
          if (taskRecord) {
            taskManager.update(taskRecord.id, {
              status: instance.status === "cancelled" ? "cancelled" : "error",
              error: instance.lastError,
              progress: instance.status === "cancelled" ? "Cancelled" : "Failed",
            });
          }
        }
      }).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
        this.runningCount = Math.max(0, this.runningCount - 1);
        this.abortControllers.delete(instance.id);
        resolve(instance);
        this.pumpQueue();
      });
    };

    return new Promise((resolve) => {
      const queuedRun = {
        agentId: instance.id,
        start: () => execute(resolve),
        cancel: () => {
          instance.status = "cancelled";
          instance.completedAt = Date.now();
          if (taskRecord) taskManager.update(taskRecord.id, { status: "cancelled", progress: "Cancelled before start" });
          resolve(instance);
        },
      };
      if (this.runningCount < this.maxConcurrentAgents) {
        queuedRun.start();
      } else {
        this.queuedRuns.push(queuedRun);
      }
    });
  }

  async invokeSubAgent(
    typeName: string,
    task: string,
    settings: Settings,
    workspaceId: string,
    toolsSchema: any[],
    executeToolCallFn: any,
    onProgress?: (agentId: string, status: string) => void,
    maxIterations?: number,
    timeoutSeconds?: number,
    displayName?: string
  ): Promise<SubAgentInstance> {
    const instance = this.createAgent(typeName, displayName, { currentTask: task });
    return this.runManagedAgent(instance, task, settings, workspaceId, toolsSchema, executeToolCallFn, {
      maxIterations,
      timeoutSeconds,
      onProgress,
    });
  }

  async assignTask(
    agentIdOrName: string,
    task: string,
    settings: Settings,
    workspaceId: string,
    toolsSchema: any[],
    executeToolCallFn: any,
    options: AgentRunOptions = {}
  ): Promise<SubAgentInstance> {
    const instance = this.resolveAgent(agentIdOrName);
    if (!instance) throw new Error(`Agent not found: ${agentIdOrName}`);
    return this.runManagedAgent(instance, task, settings, workspaceId, toolsSchema, executeToolCallFn, options);
  }

  async invokeParallel(
    tasks: Array<{ typeName: string; task: string; name?: string; maxIterations?: number; timeoutSeconds?: number }>,
    settings: Settings,
    workspaceId: string,
    toolsSchema: any[],
    executeToolCallFn: any,
    onProgress?: (agentId: string, status: string) => void
  ): Promise<SubAgentInstance[]> {
    const promises = tasks.map((t) =>
      this.invokeSubAgent(t.typeName, t.task, settings, workspaceId, toolsSchema, executeToolCallFn, onProgress, t.maxIterations, t.timeoutSeconds, t.name)
    );
    return Promise.all(promises);
  }

  killAgent(agentId: string) {
    const instance = this.resolveAgent(agentId);
    if (!instance) return;
    const remainingRuns: QueuedRun[] = [];
    for (const run of this.queuedRuns) {
      if (run.agentId === instance.id) {
        run.cancel();
      } else {
        remainingRuns.push(run);
      }
    }
    this.queuedRuns = remainingRuns;
    const ac = this.abortControllers.get(instance.id);
    ac?.abort();
    this.abortControllers.delete(instance.id);
    if (instance.status === "queued" || instance.status === "running") {
      instance.status = "cancelled";
      instance.completedAt = Date.now();
      if (instance.taskId) {
        getAgentTaskManager().update(instance.taskId, { status: "cancelled", progress: "Cancelled by user" });
      }
    }
  }

  removeAgent(agentIdOrName: string, force = false) {
    const instance = this.resolveAgent(agentIdOrName);
    if (!instance) throw new Error(`Agent not found: ${agentIdOrName}`);
    if ((instance.status === "running" || instance.status === "queued") && !force) {
      throw new Error(`Agent "${instance.displayName}" is ${instance.status}. Cancel it or pass force=true before removing.`);
    }
    if (force) this.killAgent(instance.id);
    this.activeAgents.delete(instance.id);
    this.agentNames.delete(instance.displayName.toLowerCase());
    this.abortControllers.delete(instance.id);
    this.queuedRuns = this.queuedRuns.filter((run) => run.agentId !== instance.id);
    return instance;
  }

  killAll() {
    for (const [id] of this.activeAgents) {
      this.killAgent(id);
    }
  }

  getActive(): SubAgentInstance[] {
    return Array.from(this.activeAgents.values()).filter((a) => a.status === "running");
  }

  getAll(): SubAgentInstance[] {
    return Array.from(this.activeAgents.values());
  }

  getAgent(agentId: string): SubAgentInstance | undefined {
    return this.resolveAgent(agentId);
  }
}
