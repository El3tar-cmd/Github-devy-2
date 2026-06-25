import { useState, useCallback, useEffect, useRef } from "react";
import { Settings } from "../types";
import { fetchOllamaModels, fetchLmStudioModels } from "../ollama";
import { useAgentSessions } from "./useAgentSessions";
import { runAgentLoop } from "./runAgentLoop";

export function useAgent(
  settings: Settings,
  workspaceId: string,
  onSettingsUpdate?: (s: Partial<Settings>, newWorkspaceId?: string) => void,
) {
  const {
    sessions,
    setSessions,
    sessionsRef,
    currentSessionId,
    messages,
    createSessionUpdater,
    setMessagesForCurrent,
    clearMessages,
    startNewChat,
    switchSession,
    deleteSession,
  } = useAgentSessions(workspaceId);

  const [isRunning, setIsRunning] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentSessionIdRef = useRef(currentSessionId);
  const isRunningRef = useRef(isRunning);
  const settingsRef = useRef(settings);
  const workspaceIdRef = useRef(workspaceId);
  const onSettingsUpdateRef = useRef(onSettingsUpdate);
  const resumedTaskIdsRef = useRef<Set<string>>(new Set());
  const queuedResumeTaskIdsRef = useRef<Set<string>>(new Set());
  const pendingResumeTasksRef = useRef<any[]>([]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  useEffect(() => {
    onSettingsUpdateRef.current = onSettingsUpdate;
  }, [onSettingsUpdate]);

  const startResumeForTask = useCallback((task: any) => {
    resumedTaskIdsRef.current.add(task.id);
    isRunningRef.current = true;

    const targetId = currentSessionIdRef.current;
    const updater = createSessionUpdater(targetId);
    updater((prev) => {
      const updated = [
        ...prev,
        {
          id: Math.random().toString(36),
          role: "system" as const,
          hidden: true,
          content: `[INTERNAL ORCHESTRA RESUME]
Background ${task.kind} task "${task.id}" finished with status "${task.status}".
Immediately inspect it with get_agent_task using taskId "${task.id}".
Then integrate the result into the ongoing work: summarize the useful outcome, check for errors or missing elements, run any necessary verification or follow-up tools, and continue autonomously if the original user goal still has useful next actions.
Do not ask the user whether to continue. Ask only for a true blocker.`,
        },
      ];

      window.setTimeout(() => runAgentLoop({
        currentMessages: updated,
        updateLog: updater,
        settings: settingsRef.current,
        workspaceId: workspaceIdRef.current,
        sessionsRef,
        currentSessionId: targetId,
        setSessions,
        abortControllerRef,
        onSettingsUpdate: onSettingsUpdateRef.current,
        setIsRunning,
      }), 0);

      return updated;
    });
  }, [createSessionUpdater, sessionsRef, setSessions]);

  const drainPendingResumes = useCallback(() => {
    if (isRunningRef.current) return;

    while (pendingResumeTasksRef.current.length > 0) {
      const nextTask = pendingResumeTasksRef.current.shift();
      queuedResumeTaskIdsRef.current.delete(nextTask.id);
      if (resumedTaskIdsRef.current.has(nextTask.id)) continue;
      startResumeForTask(nextTask);
      return;
    }
  }, [startResumeForTask]);

  useEffect(() => {
    isRunningRef.current = isRunning;
    if (!isRunning) {
      drainPendingResumes();
    }
  }, [isRunning, drainPendingResumes]);

  useEffect(() => {
    const onTaskCompleted = (event: Event) => {
      const task = (event as CustomEvent).detail;
      if (!task?.id) return;
      if (task.kind !== "subagent") return;
      if (task.status === "cancelled") return;
      if (resumedTaskIdsRef.current.has(task.id)) return;
      if (queuedResumeTaskIdsRef.current.has(task.id)) return;

      queuedResumeTaskIdsRef.current.add(task.id);
      pendingResumeTasksRef.current.push(task);
      drainPendingResumes();
    };

    window.addEventListener("agent-task-completed", onTaskCompleted);
    return () => window.removeEventListener("agent-task-completed", onTaskCompleted);
  }, [drainPendingResumes]);

  const abortAgent = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRunning(false);
  };

  const loadModels = useCallback(async () => {
    setModelsError(null);
    if (settings.apiProvider === "ollama") {
      if (!settings.ollamaUrl) return;
      const { models: m, error } = await fetchOllamaModels(settings.ollamaUrl);
      setModels(m);
      if (error) setModelsError(error);
    } else if (settings.apiProvider === "lmstudio") {
      if (!settings.lmStudioUrl) return;
      const { models: m, error } = await fetchLmStudioModels(settings.lmStudioUrl);
      setModels(m);
      if (error) setModelsError(error);
    }
  }, [settings.apiProvider, settings.ollamaUrl, settings.lmStudioUrl]);

  const sendMessage = async (text: string) => {
    const userMsg = {
      id: Math.random().toString(36),
      role: "user" as const,
      content: text,
    };

    const activeId = currentSessionId;
    const boundedUpdater = createSessionUpdater(activeId);

    boundedUpdater((prev) => {
      const updated = [...prev, userMsg];
      setTimeout(() => runAgentLoop({
        currentMessages: updated,
        updateLog: boundedUpdater,
        settings,
        workspaceId,
        sessionsRef,
        currentSessionId: activeId,
        setSessions,
        abortControllerRef,
        onSettingsUpdate,
        setIsRunning,
      }), 0);
      return updated;
    });
  };

  return {
    messages,
    sendMessage,
    isRunning,
    clearMessages,
    models,
    modelsError,
    loadModels,
    sessions,
    currentSessionId,
    startNewChat,
    switchSession,
    deleteSession,
    abortAgent,
  };
}
