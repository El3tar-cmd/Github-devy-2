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
    "editor" | "browser" | "terminal" | "search" | "git" | "db" | "debugger" | "package" | "builder" | "planner" | "trajectory" | "ast" | "sandbox" | "agents"
  >("editor");

  const [askHumanQuestion, setAskHumanQuestion] = useState<string | null>(null);
  const [askHumanResolve, setAskHumanResolve] = useState<((val: string) => void) | null>(null);
  const [askHumanInput, setAskHumanInput] = useState("");

  useEffect(() => {
    (window as any).askHuman = (question: string) => {
      return new Promise<string>((resolve) => {
        setAskHumanQuestion(question);
        setAskHumanResolve(() => resolve);
        setAskHumanInput("");
      });
    };
    return () => {
      delete (window as any).askHuman;
    };
  }, []);

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
    <div className="flex h-[100dvh] bg-[#09090b] text-slate-200 overflow-hidden font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
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

      {askHumanQuestion && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4 font-sans">
          <div className="bg-[#121217] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <span className="text-emerald-400 font-bold text-sm">💡 DEVY REQUIRES INPUT</span>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed font-mono bg-white/5 p-3 rounded-lg border border-white/5 whitespace-pre-wrap">
              {askHumanQuestion}
            </p>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (askHumanResolve) {
                  askHumanResolve(askHumanInput);
                }
                setAskHumanQuestion(null);
                setAskHumanResolve(null);
                setAskHumanInput("");
              }} 
              className="flex flex-col gap-4"
            >
              <textarea
                value={askHumanInput}
                onChange={(e) => setAskHumanInput(e.target.value)}
                placeholder="Enter your answer, instructions, or credentials here..."
                required
                className="w-full h-24 bg-[#1d1d26] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none border border-white/5 focus:border-emerald-500/50 transition-colors resize-none leading-relaxed"
              />

              <button
                type="submit"
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-bold transition-colors w-full text-center shadow-lg shadow-emerald-500/10"
              >
                Send Response
              </button>
            </form>
          </div>
        </div>
      )}
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
