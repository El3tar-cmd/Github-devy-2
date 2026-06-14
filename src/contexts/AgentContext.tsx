import React, { createContext, useContext, useState, useEffect } from "react";
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

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { workspaceId, setWorkspaceId, fetchTree, fetchWorkspaces } = useWorkspaceContext();

  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const s = typeof window !== "undefined" ? localStorage.getItem("agent_settings") : null;
      const parsed = s ? JSON.parse(s) : {};
      return { ...defaultSettings, ...parsed };
    } catch (e) {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem("agent_settings", JSON.stringify(settings));
  }, [settings]);

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
  }, [settings.ollamaUrl]);

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
        alert("Failed to clone: " + res.error);
      }
    } catch (e: any) {
      alert("Error initializing repository: " + e.message);
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
