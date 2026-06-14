import { useState, useEffect, useRef } from "react";
import { defaultSettings, Settings, defaultSystemPrompt } from "./types";
import { useAgent } from "./useAgent";
import { SettingsPanel } from "./components/SettingsPanel";
import { ChatMessageUI } from "./components/ChatMessageUI";
import {
  Terminal,
  Send,
  SidebarClose,
  SidebarOpen,
  Loader2,
  PlusCircle,
  MessageSquare,
  Trash2,
  Square,
  ClipboardList,
} from "lucide-react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { useWorkspace } from "./useWorkspace";
import { FileTree } from "./components/FileTree";
import { initializeRepo } from "./ollama";

import { SearchUI } from "./components/SearchUI";
import { TerminalUI } from "./components/TerminalUI";
import { BrowserPreview } from "./components/BrowserPreview";

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const s =
        typeof window !== "undefined"
          ? localStorage.getItem("agent_settings")
          : null;
      const parsed = s ? JSON.parse(s) : {};
      if (
        parsed.systemPrompt === "You are an AI coding agent..." ||
        (parsed.systemPrompt &&
          !parsed.systemPrompt.includes("INTERACTION PRINCIPLES")) ||
        (parsed.systemPrompt &&
          !parsed.systemPrompt.includes(".chromium-profile"))
      ) {
        parsed.systemPrompt = defaultSystemPrompt;
      }
      return { ...defaultSettings, ...parsed };
    } catch (e) {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem("agent_settings", JSON.stringify(settings));
  }, [settings]);

  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : true,
  );

  useEffect(() => {
    let lastWidth = window.innerWidth;
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (currentWidth >= 768 && lastWidth < 768) {
        setSidebarOpen(true);
      } else if (currentWidth < 768 && lastWidth >= 768) {
        setSidebarOpen(false);
      }
      lastWidth = currentWidth;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [inputStr, setInputStr] = useState("");
  const [initLoading, setInitLoading] = useState(false);
  const [initSuccess, setInitSuccess] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [workspaceId, setWorkspaceId] = useState<string>(() => {
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

  const [availableWorkspaces, setAvailableWorkspaces] = useState<string[]>([]);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (res.ok) {
        const data = await res.json();
        setAvailableWorkspaces(data.workspaces || []);
      }
    } catch (e) {
      console.error("Failed to fetch workspaces", e);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [workspaceId]);

  const {
    messages,
    sendMessage,
    isRunning,
    models,
    modelsError,
    loadModels,
    sessions,
    currentSessionId,
    startNewChat,
    switchSession,
    deleteSession,
    clearMessages,
    abortAgent,
  } = useAgent(settings, workspaceId, (partial, newWorkspaceId) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    if (newWorkspaceId) {
      setWorkspaceId(newWorkspaceId);
      localStorage.setItem("active_workspace_id", newWorkspaceId);
    }
    setInitSuccess(true);
  });

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isRunning]);

  const [activeTab, setActiveTab] = useState<"chat" | "ide">("chat");
  const [ideTab, setIdeTab] = useState<
    "editor" | "browser" | "terminal" | "search"
  >("editor");
  const [isDiffMode, setIsDiffMode] = useState(false);
  const {
    tree,
    fetchTree,
    selectedFile,
    setSelectedFile,
    fileContent,
    setFileContent,
    originalContent,
    openFile,
    saveFile,
    isWorkspaceReady,
  } = useWorkspace(workspaceId);

  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // Auto-save effect
  useEffect(() => {
    if (!selectedFile) return;
    if (fileContent === originalContent) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("unsaved");

    const timer = setTimeout(async () => {
      setSaveStatus("saving");
      await saveFile(selectedFile, fileContent);
      setSaveStatus("saved");
    }, 1000); // 1-second auto-save debounce timer

    return () => clearTimeout(timer);
  }, [fileContent, selectedFile, originalContent, saveFile]);

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
            // Clean it to be safe as a pathname
            const cleanName = last.replace(/[^a-zA-Z0-9_.-]/g, "_");
            targetWorkspaceId = cleanName;
            setWorkspaceId(cleanName);
            localStorage.setItem("active_workspace_id", cleanName);
          }
        } catch (e) {
          console.error("Failed to parse repo name", e);
        }
      }

      const res = await initializeRepo(
        settings.repoUrl,
        settings.githubToken,
        targetWorkspaceId,
      );
      if (res.success) {
        setInitSuccess(true);
        fetchTree(); // Fetch tree immediately
        fetchWorkspaces(); // Update existing workspaces list
      } else {
        alert("Failed to clone: " + res.error);
      }
    } catch (e: any) {
      alert("Error initializing repository: " + e.message);
    } finally {
      setInitLoading(false);
    }
  };

  const submitTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRunning) {
      abortAgent();
      return;
    }
    if (!inputStr.trim()) return;
    sendMessage(inputStr.trim());
    setInputStr("");
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-slate-200 overflow-hidden font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
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
            onWorkspaceIdChange={(id) => {
              setWorkspaceId(id);
              localStorage.setItem("active_workspace_id", id);
            }}
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
                  className={`group flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer ${s.id === currentSessionId ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-sm" : "bg-[#1e1e24] border-white/5 text-slate-400 hover:text-slate-200 hover:bg-[#2a2a32]"}`}
                  onClick={() => {
                    switchSession(s.id);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
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
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-rose-400 text-slate-500 hover:bg-rose-500/10 rounded-md transition-all shrink-0"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative w-full overflow-hidden bg-gradient-to-b from-[#0e0e11] to-[#09090b]">
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-white/5 bg-[#0e0e11]/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/5"
            >
              {sidebarOpen ? (
                <SidebarClose className="w-5 h-5" />
              ) : (
                <SidebarOpen className="w-5 h-5" />
              )}
            </button>
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-500" />
              <h1 className="font-semibold text-white tracking-tight hidden sm:block">
                Agent<span className="text-emerald-500 font-bold">CLI</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#1e1e24] p-1 rounded-xl lg:hidden">
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${activeTab === "chat" ? "bg-[#34343d] text-white shadow-sm" : "text-slate-400"}`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab("ide")}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${activeTab === "ide" ? "bg-[#34343d] text-white shadow-sm" : "text-slate-400"}`}
            >
              IDE
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-xs font-mono text-slate-500 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
              {settings.apiProvider === "ollama"
                ? settings.ollamaModel || "No Ollama model"
                : settings.geminiModel || "No Gemini model"}
            </div>
            <button
              onClick={clearMessages}
              className="p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/10"
              title="Clear current chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden w-full relative">
          {/* Chat Panel */}
          <div
            className={`flex-1 min-w-0 w-full flex flex-col relative h-full ${activeTab === "chat" ? "flex" : "hidden lg:flex"} lg:border-r border-white/5 bg-[#0b0b0e]`}
          >
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 scroll-smooth will-change-scroll pb-32">
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.length === 0 && (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-4">
                    <Terminal className="w-12 h-12 text-slate-700/50" />
                    <p className="text-sm">
                      Connect a repo and start tasking the agent.
                    </p>
                  </div>
                )}
                {messages.map((m) => (
                  <ChatMessageUI key={m.id} msg={m} />
                ))}
                {isRunning && (
                  <div className="flex items-center gap-3 text-emerald-500 text-sm font-mono p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10 w-fit">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Agent is processing...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Form */}
            <div className="absolute bottom-6 left-0 right-0 max-w-3xl mx-auto px-4 md:px-6">
              {!isRunning && (
                <div className="flex gap-2 mb-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setInputStr(
                        "Please act as a tech lead and construct a detailed plan in 'plan.md' for this project. If 'plan.md' already exists, read its contents first, then update it reflecting what is completed and what remains. Make sure to use markdown task lists (- [ ] and - [x]).",
                      );
                    }}
                    className="text-[11px] font-medium bg-[#2a2a32]/80 hover:bg-[#3b3b46] text-emerald-400 px-3 py-1.5 rounded-lg border border-white/5 transition-colors flex items-center gap-1.5 shadow-sm backdrop-blur-sm"
                  >
                    <ClipboardList className="w-3.5 h-3.5" /> Generate / Update
                    Plan
                  </button>
                </div>
              )}
              <form
                onSubmit={submitTx}
                className="relative flex items-center bg-[#1e1e24] border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden transition-all focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:border-emerald-500/30"
              >
                <input
                  value={inputStr}
                  onChange={(e) => setInputStr(e.target.value)}
                  disabled={
                    isRunning ||
                    (settings.apiProvider === "ollama"
                      ? !settings.ollamaModel
                      : !settings.geminiApiKey)
                  }
                  placeholder={
                    isRunning
                      ? "Agent is working..."
                      : "Ask the agent to modify code..."
                  }
                  className="flex-1 bg-transparent py-4 pl-6 pr-14 text-white outline-none placeholder-slate-500 disabled:opacity-50 text-sm leading-relaxed"
                />
                <button
                  type="submit"
                  disabled={
                    (!inputStr.trim() && !isRunning) ||
                    (settings.apiProvider === "ollama"
                      ? !settings.ollamaModel
                      : !settings.geminiApiKey)
                  }
                  className={`absolute right-3 p-2 rounded-xl transition-all ${
                    isRunning
                      ? "bg-rose-500 hover:bg-rose-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                      : "bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-30 disabled:hover:bg-emerald-500"
                  }`}
                  title={isRunning ? "Stop Agent" : "Send Message"}
                >
                  {isRunning ? (
                    <Square className="w-4 h-4 fill-current" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* IDE Panel */}
          <div
            className={`flex-[1.5] flex flex-col min-w-0 ${activeTab === "ide" ? "flex" : "hidden lg:flex"}`}
          >
            <div className="h-10 border-b border-white/5 bg-[#151519] flex items-center justify-between px-4 shrink-0 overflow-x-auto gap-4">
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setIdeTab("editor")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${ideTab === "editor" ? "bg-[#2a2a32] text-emerald-400 shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
                >
                  Editor
                </button>
                <button
                  onClick={() => setIdeTab("browser")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${ideTab === "browser" ? "bg-[#2a2a32] text-emerald-400 shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setIdeTab("terminal")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${ideTab === "terminal" ? "bg-[#2a2a32] text-emerald-400 shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
                >
                  Terminal
                </button>
                <button
                  onClick={() => setIdeTab("search")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${ideTab === "search" ? "bg-[#2a2a32] text-emerald-400 shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
                >
                  Search
                </button>
              </div>
              {ideTab === "editor" && selectedFile && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-slate-500 truncate max-w-[150px] md:max-w-xs block">
                    {selectedFile}
                  </span>
                  
                  <span className={`text-[10px] px-2 py-0.5 rounded transition-all font-sans font-medium flex items-center gap-1 ${
                    saveStatus === "saving" 
                      ? "text-amber-400 bg-amber-400/10 animate-pulse" 
                      : saveStatus === "unsaved"
                      ? "text-blue-400 bg-blue-500/10"
                      : "text-emerald-400 bg-emerald-500/10"
                  }`}>
                    {saveStatus === "saving" && "جاري الحفظ تلقائياً..."}
                    {saveStatus === "unsaved" && "تغييرات غير محفوظة"}
                    {saveStatus === "saved" && "تم الحفظ تلقائياً"}
                  </span>

                  <button
                    onClick={() => setIsDiffMode(!isDiffMode)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${isDiffMode ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
                  >
                    Diff Mode
                  </button>
                  <button
                    onClick={() => {
                      saveFile(selectedFile, fileContent);
                    }}
                    className="text-xs px-2 py-1 bg-emerald-500 text-black rounded font-medium hover:bg-emerald-400 transition-colors"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 flex overflow-hidden">
              {ideTab === "editor" ? (
                <>
                  <div className="w-56 overflow-y-auto border-r border-white/5 bg-[#0e0e11] shrink-0">
                    <FileTree
                      tree={tree}
                      selectedPath={selectedFile}
                      onSelect={(p) => {
                        openFile(p);
                      }}
                      workspaceId={workspaceId}
                      onRefresh={fetchTree}
                      onDeleteWorkspace={() => {
                        setSelectedFile(null);
                        setFileContent("");
                      }}
                    />
                  </div>
                  <div className="flex-1 flex flex-col min-w-0 bg-[#0e0e11]">
                    {selectedFile ? (
                      isDiffMode ? (
                        <DiffEditor
                          height="100%"
                          theme="vs-dark"
                          original={originalContent}
                          modified={fileContent}
                          language={
                            selectedFile.split(".").pop() || "plaintext"
                          }
                          options={{
                            minimap: { enabled: false },
                            readOnly: false,
                            fontSize: 13,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                          onMount={(editor) => {
                            editor
                              .getModifiedEditor()
                              .onDidChangeModelContent(() => {
                                setFileContent(
                                  editor.getModifiedEditor().getValue(),
                                );
                              });
                          }}
                        />
                      ) : (
                        <Editor
                          height="100%"
                          theme="vs-dark"
                          value={fileContent}
                          language={
                            selectedFile.split(".").pop() || "plaintext"
                          }
                          options={{
                            minimap: { enabled: false },
                            fontSize: 13,
                            fontFamily: "'JetBrains Mono', monospace",
                            wordWrap: "on",
                          }}
                          onChange={(v) => setFileContent(v || "")}
                        />
                      )
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                        Select a file to view
                      </div>
                    )}
                  </div>
                </>
              ) : ideTab === "browser" ? (
                <BrowserPreview />
              ) : ideTab === "terminal" ? (
                <TerminalUI workspaceId={workspaceId} />
              ) : (
                <SearchUI
                  workspaceId={workspaceId}
                  onOpen={(p) => {
                    openFile(p);
                    setIdeTab("editor");
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
