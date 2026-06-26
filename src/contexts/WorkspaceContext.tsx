import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { FileNode } from "../types";
import { useWorkspace } from "../useWorkspace";

interface WorkspaceContextType {
  workspaceId: string;
  setWorkspaceId: (id: string) => void;
  availableWorkspaces: string[];
  fetchWorkspaces: () => Promise<void>;
  tree: FileNode[];
  fetchTree: () => Promise<void>;
  selectedFile: string | null;
  setSelectedFile: (file: string | null) => void;
  fileContent: string;
  setFileContent: (content: string) => void;
  originalContent: string;
  openFile: (path: string) => Promise<void>;
  saveFile: (path: string, content: string) => Promise<void>;
  isWorkspaceReady: boolean;
  saveStatus: "saved" | "saving" | "unsaved";
  setSaveStatus: (status: "saved" | "saving" | "unsaved") => void;
  isDiffMode: boolean;
  setIsDiffMode: (mode: boolean) => void;
  targetLine: number | null;
  setTargetLine: (line: number | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaceId, setWorkspaceIdState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("active_workspace_id");
      if (saved) return saved;
    }
    const res = Math.random().toString(36).substring(7);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_workspace_id", res);
    }
    return res;
  });

  const setWorkspaceId = (id: string) => {
    setWorkspaceIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_workspace_id", id);
    }
  };

  const [availableWorkspaces, setAvailableWorkspaces] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [targetLine, setTargetLine] = useState<number | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (res.ok) {
        const data = await res.json();
        setAvailableWorkspaces(data.workspaces || []);
      }
    } catch (e) {
      console.error("Failed to fetch workspaces", e);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [workspaceId, fetchWorkspaces]);

  const workspaceData = useWorkspace(workspaceId);

  // Auto-select first available workspace if current workspaceId is empty/falsy,
  // or clear to empty string if no workspaces exist.
  useEffect(() => {
    if (availableWorkspaces.length > 0) {
      if (!workspaceId) {
        setWorkspaceId(availableWorkspaces[0]);
      }
    } else {
      if (workspaceId !== "") {
        setWorkspaceId("");
      }
    }
  }, [availableWorkspaces, workspaceId]);

  // Auto-save logic
  useEffect(() => {
    if (!workspaceData.selectedFile) return;
    if (workspaceData.fileContent === workspaceData.originalContent) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("unsaved");

    const timer = setTimeout(async () => {
      setSaveStatus("saving");
      await workspaceData.saveFile(workspaceData.selectedFile!, workspaceData.fileContent);
      setSaveStatus("saved");
    }, 1000);

    return () => clearTimeout(timer);
  }, [workspaceData.fileContent, workspaceData.selectedFile, workspaceData.originalContent, workspaceData.saveFile]);

  const fetchTree = useCallback(async () => {
    await workspaceData.fetchTree();
    await fetchWorkspaces();
  }, [workspaceData.fetchTree, fetchWorkspaces]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaceId,
        setWorkspaceId,
        availableWorkspaces,
        fetchWorkspaces,
        tree: workspaceData.tree,
        fetchTree,
        selectedFile: workspaceData.selectedFile,
        setSelectedFile: workspaceData.setSelectedFile,
        fileContent: workspaceData.fileContent,
        setFileContent: workspaceData.setFileContent,
        originalContent: workspaceData.originalContent,
        openFile: workspaceData.openFile,
        saveFile: workspaceData.saveFile,
        isWorkspaceReady: workspaceData.isWorkspaceReady,
        saveStatus,
        setSaveStatus,
        isDiffMode,
        setIsDiffMode,
        targetLine,
        setTargetLine,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspaceContext = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspaceContext must be used within a WorkspaceProvider");
  }
  return context;
};
