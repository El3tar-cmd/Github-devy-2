import { useState, useEffect } from "react";
import { Terminal, Trash2, SidebarClose, SidebarOpen } from "lucide-react";

// Contexts
import { WorkspaceProvider, useWorkspaceContext } from "./contexts/WorkspaceContext";
import { AgentProvider, useAgentContext } from "./contexts/AgentContext";

// Layout Components
import { SidebarLayout } from "./components/layout/SidebarLayout";
import { ChatLayout } from "./components/layout/ChatLayout";
import { IdeLayout } from "./components/layout/IdeLayout";

function MainApp() {
  const {
    workspaceId,
    setWorkspaceId,
    availableWorkspaces,
    fetchWorkspaces,
  } = useWorkspaceContext();

  const {
    settings,
    clearMessages,
  } = useAgentContext();

  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );

  const [activeTab, setActiveTab] = useState<"chat" | "ide">("chat");
  const [ideTab, setIdeTab] = useState<
    "editor" | "browser" | "terminal" | "search" | "git" | "db" | "debugger" | "package" | "builder"
  >("editor");

  // Handle window resizing to close/open sidebar dynamically
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

  return (
    <div className="flex h-screen bg-[#09090b] text-slate-200 overflow-hidden font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Left Sidebar layout */}
      <SidebarLayout
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        setIdeTab={setIdeTab}
      />

      {/* Main Panel layout */}
      <div className="flex-1 flex flex-col relative w-full overflow-hidden bg-gradient-to-b from-[#0e0e11] to-[#09090b]">
        {/* Top Header */}
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
                Github-<span className="text-emerald-500 font-bold">devy</span>
              </h1>
            </div>
          </div>

          {/* Chat / IDE tabs switcher for mobile viewports */}
          <div className="flex items-center gap-2 bg-[#1e1e24] p-1 rounded-xl lg:hidden">
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
                activeTab === "chat" ? "bg-[#34343d] text-white shadow-sm" : "text-slate-400"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab("ide")}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
                activeTab === "ide" ? "bg-[#34343d] text-white shadow-sm" : "text-slate-400"
              }`}
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

        {/* Content Container (Chat panel + IDE panel) */}
        <div className="flex-1 flex overflow-hidden w-full relative">
          {/* Chat Panel */}
          <ChatLayout activeTab={activeTab} />

          {/* IDE Panel */}
          <IdeLayout
            ideTab={ideTab}
            setIdeTab={setIdeTab}
            activeTab={activeTab}
          />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <AgentProvider>
        <MainApp />
      </AgentProvider>
    </WorkspaceProvider>
  );
}
