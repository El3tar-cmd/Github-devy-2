import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { Settings, defaultSettings, ChatMessage, ChatSession } from "../types";
import { useAgent } from "../useAgent";
import { useWorkspaceContext } from "./WorkspaceContext";
import { initializeRepo } from "../ollama";

interface AgentContextType {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<void>;
  isRunning: boolean;
  models: string[];
  modelsError: string | null;
  loadModels: () => Promise<void>;
  sessions: ChatSession[];
  currentSessionId: string;
  startNewChat: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  clearMessages: () => void;
  abortAgent: () => void;
  initLoading: boolean;
  setInitLoading: (loading: boolean) => void;
  initSuccess: boolean;
  setInitSuccess: (success: boolean) => void;
  handleInitWorkspace: () => Promise<void>;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

const DEFAULT_PROJECT_SETTINGS_KEY = "__default__";

function getProjectSettingsKey(workspaceId: string) {
  return `agent_project_settings_${workspaceId || DEFAULT_PROJECT_SETTINGS_KEY}`;
}

function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch (e) {
    return fallback;
  }
}

function getStoredSettings(workspaceId: string): Settings {
  const globalSettings = readJsonStorage<Partial<Settings>>("agent_settings", {});
  const projectSettings = readJsonStorage<Partial<Settings>>(getProjectSettingsKey(workspaceId), {});
  return {
    ...defaultSettings,
    ...globalSettings,
    repoUrl: projectSettings.repoUrl ?? globalSettings.repoUrl ?? defaultSettings.repoUrl,
    githubToken: projectSettings.githubToken ?? globalSettings.githubToken ?? defaultSettings.githubToken,
  };
}

function persistSettings(workspaceId: string, settings: Settings) {
  if (typeof window === "undefined") return;

  const { repoUrl, githubToken, ...globalSettings } = settings;
  localStorage.setItem("agent_settings", JSON.stringify(globalSettings));
  localStorage.setItem(
    getProjectSettingsKey(workspaceId),
    JSON.stringify({ repoUrl, githubToken }),
  );
}

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { workspaceId, setWorkspaceId, fetchTree, fetchWorkspaces } = useWorkspaceContext();

  const [settings, setSettings] = useState<Settings>(() => getStoredSettings(workspaceId));
  const previousWorkspaceIdRef = useRef(workspaceId);
  const skipNextPersistRef = useRef(false);

  useEffect(() => {
    if (previousWorkspaceIdRef.current === workspaceId) return;

    previousWorkspaceIdRef.current = workspaceId;
    skipNextPersistRef.current = true;
    setSettings((prev) => {
      const projectSettings = getStoredSettings(workspaceId);
      return {
        ...prev,
        repoUrl: projectSettings.repoUrl,
        githubToken: projectSettings.githubToken,
      };
    });
  }, [workspaceId]);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    persistSettings(workspaceId, settings);
  }, [settings, workspaceId]);

  const [initLoading, setInitLoading] = useState(false);
  const [initSuccess, setInitSuccess] = useState(false);

  const agentData = useAgent(settings, workspaceId, (partial, newWorkspaceId) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    if (newWorkspaceId) {
      setWorkspaceId(newWorkspaceId);
    }
    setInitSuccess(true);
  });

  useEffect(() => {
    agentData.loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.apiProvider, settings.ollamaUrl, settings.lmStudioUrl]);

  const handleInitWorkspace = async () => {
    setInitLoading(true);
    setInitSuccess(false);
    try {
      let targetWorkspaceId = workspaceId;
      if (settings.repoUrl) {
        try {
          const trimmed = settings.repoUrl.trim().replace(/\/$/, "");
          const parts = trimmed.split("/");
          let last = parts[parts.length - 1];
          if (last.endsWith(".git")) {
            last = last.slice(0, -4);
          }
          if (last) {
            const cleanName = last.replace(/[^a-zA-Z0-9_.-]/g, "_");
            targetWorkspaceId = cleanName;
            setWorkspaceId(cleanName);
          }
        } catch (e) {
          console.error("Failed to parse repo name", e);
        }
      }

      const res = await initializeRepo(
        settings.repoUrl,
        settings.githubToken,
        targetWorkspaceId
      );
      
      if (res.success) {
        setInitSuccess(true);
        fetchTree();
        fetchWorkspaces();
      } else {
        import("../lib/toast").then(({ toast }) => toast.error("Failed to clone: " + res.error));
      }
    } catch (e: any) {
      import("../lib/toast").then(({ toast }) => toast.error("Error initializing repository: " + e.message));
    } finally {
      setInitLoading(false);
    }
  };

  return (
    <AgentContext.Provider
      value={{
        settings,
        setSettings,
        messages: agentData.messages,
        sendMessage: agentData.sendMessage,
        isRunning: agentData.isRunning,
        models: agentData.models,
        modelsError: agentData.modelsError,
        loadModels: agentData.loadModels,
        sessions: agentData.sessions,
        currentSessionId: agentData.currentSessionId,
        startNewChat: agentData.startNewChat,
        switchSession: agentData.switchSession,
        deleteSession: agentData.deleteSession,
        clearMessages: agentData.clearMessages,
        abortAgent: agentData.abortAgent,
        initLoading,
        setInitLoading,
        initSuccess,
        setInitSuccess,
        handleInitWorkspace,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
};

export const useAgentContext = () => {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgentContext must be used within an AgentProvider");
  }
  return context;
};
