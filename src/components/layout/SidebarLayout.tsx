import React from "react";
import { PlusCircle, MessageSquare, Trash2, Loader2 } from "lucide-react";
import { useWorkspaceContext } from "../../contexts/WorkspaceContext";
import { useAgentContext } from "../../contexts/AgentContext";
import { SettingsPanel } from "../SettingsPanel";
import { PortManager } from "../PortManager";

interface SidebarLayoutProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setIdeTab: (tab: "editor" | "browser" | "terminal" | "search" | "git" | "db" | "debugger" | "package" | "builder" | "planner" | "trajectory" | "ast" | "sandbox" | "agents") => void;
}

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({
  sidebarOpen,
  setSidebarOpen,
  setIdeTab,
}) => {
  const {
    workspaceId,
    setWorkspaceId,
    availableWorkspaces,
    fetchWorkspaces,
  } = useWorkspaceContext();

  const {
    settings,
    setSettings,
    models,
    modelsError,
    loadModels,
    handleInitWorkspace,
    initLoading,
    initSuccess,
    sessions,
    currentSessionId,
    startNewChat,
    switchSession,
    deleteSession,
  } = useAgentContext();

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm ease-in-out duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 left-0 bottom-0 md:relative z-40 h-full bg-[#0c0c0e] border-r border-white/5 transition-all duration-300 ease-in-out overflow-hidden shrink-0 flex flex-col ${
          sidebarOpen
            ? "w-[85vw] md:w-80 translate-x-0"
            : "w-[85vw] md:w-0 -translate-x-full md:translate-x-0 md:border-r-0"
        }`}
      >
        <div className="p-6 h-full overflow-y-auto w-[85vw] md:w-80 flex flex-col">
          <SettingsPanel
            settings={settings}
            setSettings={setSettings}
            models={models}
            modelsError={modelsError}
            loadModels={loadModels}
            initializeWorkspace={handleInitWorkspace}
            workspaceId={workspaceId}
            onWorkspaceIdChange={setWorkspaceId}
            availableWorkspaces={availableWorkspaces}
            onRefreshWorkspaces={fetchWorkspaces}
          />

          {initLoading && (
            <div className="mt-4 text-emerald-400 text-sm flex gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Setting up IDE...
            </div>
          )}
          {initSuccess && (
            <div className="mt-4 text-emerald-500 text-sm flex gap-2">
              ✔ Workspace Ready
            </div>
          )}

          <PortManager
            workspaceId={workspaceId}
            onOpenPreview={(port) => {
              localStorage.setItem("browser_preview_url", `/proxy/${port}/`);
              localStorage.setItem("browser_preview_input_url", `http://localhost:${port}`);
              window.dispatchEvent(new CustomEvent("open-browser-preview", { detail: { port } }));
              setIdeTab("browser");
            }}
          />

          <div className="mt-10 flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Chat History
              </h3>
              <button
                onClick={startNewChat}
                className="text-emerald-500 hover:text-emerald-400 p-1"
                title="New Chat"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {sessions.length === 0 && (
                <p className="text-xs text-slate-600">No recent chats.</p>
              )}
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center justify-between gap-2 p-3 rounded-xl border transition-colors cursor-pointer ${
                    s.id === currentSessionId
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-sm"
                      : "bg-[#1e1e24] border-white/5 text-slate-400 hover:text-slate-200 hover:bg-[#2a2a32]"
                  }`}
                  onClick={() => {
                    switchSession(s.id);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                    <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                    <span className="text-sm truncate">
                      {s.title || "Empty chat"}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(s.id);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-500/10 bg-rose-500/5 px-2 py-1 text-[11px] font-medium text-rose-400 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
                    title="Delete Chat"
                    aria-label={`Delete chat ${s.title || "Empty chat"}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
