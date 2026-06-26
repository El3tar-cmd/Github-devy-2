import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ClipboardList, Play, CheckCircle, Circle, RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { useAgentContext } from "../contexts/AgentContext";
import { useEventBus } from "../useEventBus";

interface PlannerPanelProps {
  workspaceId: string;
}

export function PlannerPanel({ workspaceId }: PlannerPanelProps) {
  const { sendMessage, settings, setSettings } = useAgentContext();
  const { subscribe } = useEventBus(workspaceId);
  const [planContent, setPlanContent] = useState<string>("");
  const [tasksContent, setTasksContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showInitModal, setShowInitModal] = useState(false);
  const [projectDescription, setProjectDescription] = useState("");

  const fetchPlanFiles = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch plan.md
      const planRes = await fetch("/api/fs/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: ".github-devy/plan.md", workspaceId }),
      });
      let planText = "";
      if (planRes.ok) {
        const data = await planRes.json();
        planText = data.content || "";
      }

      // Fetch tasks.md
      const tasksRes = await fetch("/api/fs/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: ".github-devy/tasks.md", workspaceId }),
      });
      let tasksText = "";
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        tasksText = data.content || "";
      }

      setPlanContent(planText);
      setTasksContent(tasksText);
    } catch (e: any) {
      setError("Failed to load plan or tasks from workspace.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchPlanFiles();
  }, [workspaceId, fetchPlanFiles]);

  useEffect(() => {
    if (!workspaceId) return;
    return subscribe("fs:changed", () => {
      fetchPlanFiles();
    });
  }, [workspaceId, subscribe, fetchPlanFiles]);

  const handleToggleTask = async (lineIndex: number, currentStatus: boolean) => {
    if (!tasksContent) return;
    const lines = tasksContent.split("\n");
    const targetLine = lines[lineIndex];

    // Toggle [ ] <-> [x]
    let updatedLine = targetLine;
    if (currentStatus) {
      // Completed -> Todo
      updatedLine = targetLine.replace(/\[[xX]\]/, "[ ]");
    } else {
      // Todo -> Completed
      updatedLine = targetLine.replace(/\[\s*\]/, "[x]");
    }

    lines[lineIndex] = updatedLine;
    const newContent = lines.join("\n");
    setTasksContent(newContent);

    try {
      await fetch("/api/fs/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: ".github-devy/tasks.md",
          content: newContent,
          workspaceId,
        }),
      });
    } catch (err) {
      console.error("Failed to write updated tasks:", err);
      setError("Failed to save checked task to workspace.");
    }
  };

  const handleInitializePlan = () => {
    setShowInitModal(true);
  };

  const handleConfirmInitialize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectDescription.trim()) return;

    setSettings((prev) => ({ ...prev, planModeActive: true }));
    sendMessage(
      `Please act as a tech lead and construct a detailed plan in '.github-devy/plan.md' and tasks checklist in '.github-devy/tasks.md' for the following scope: "${projectDescription.trim()}". Keep tasks list clear and granular using markdown checkboxes (- [ ] and - [x]).`
    );
    setShowInitModal(false);
    setProjectDescription("");
  };

  // Parse tasks list
  const lines = tasksContent.split("\n");
  const parsedTasks = lines.map((line, idx) => {
    const isTodo = line.trim().startsWith("- [ ]") || line.trim().startsWith("* [ ]");
    const isDone =
      line.trim().startsWith("- [x]") ||
      line.trim().startsWith("- [X]") ||
      line.trim().startsWith("* [x]") ||
      line.trim().startsWith("* [X]");

    if (isTodo || isDone) {
      // Extract task label
      const label = line.replace(/^[\s-*]*\[[ xX]\]\s*/, "");
      return {
        index: idx,
        isTask: true,
        completed: isDone,
        label,
      };
    }
    return {
      index: idx,
      isTask: false,
      completed: false,
      label: line,
    };
  });

  const allTasks = parsedTasks.filter((t) => t.isTask);
  const completedTasks = allTasks.filter((t) => t.completed);
  const progressPercent = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-[#0b0b0e] text-white">
      {/* Top Header */}
      <div className="h-14 border-b border-white/5 px-6 flex items-center justify-between shrink-0 bg-[#0e0e11]">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-semibold">Project Planner & Todo Board</h2>
        </div>
        <div className="flex items-center gap-3">
          {settings.planModeActive && (
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono font-medium animate-pulse">
              <Sparkles className="w-3 h-3" /> Plan Mode Active
            </span>
          )}
          <button
            onClick={fetchPlanFiles}
            className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="Reload Plan"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!planContent && !tasksContent ? (
          <div className="h-96 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
            <div className="p-4 bg-[#141419] border border-white/5 rounded-full text-slate-500 shadow-inner">
              <ClipboardList className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">No Plan or Tasks Found</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Enable <strong>Plan Mode</strong> and ask Devy to analyze this workspace and build a roadmap. It will be stored inside <code>.github-devy/</code> folder and updated in real-time.
              </p>
            </div>
            <button
              onClick={handleInitializePlan}
              className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" /> Initialize Plan & Tasks
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Checklist Column */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-[#141419] border border-white/5 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-slate-300">Tasks Checklist</h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {completedTasks.length} / {allTasks.length} Done ({progressPercent}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-[#202027] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="space-y-2 pt-2">
                  {allTasks.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No checklist items found in tasks.md</p>
                  ) : (
                    parsedTasks.map((t, idx) => {
                      if (!t.isTask) {
                        // Render standard headers/non-task lines beautifully
                        if (!t.label.trim()) return <div key={idx} className="h-2" />;
                        if (t.label.startsWith("###")) {
                          return (
                            <h4 key={idx} className="text-xs font-semibold text-emerald-400/90 pt-3 pb-1 uppercase tracking-wider">
                              {t.label.replace(/^###\s*/, "")}
                            </h4>
                          );
                        }
                        if (t.label.startsWith("##")) {
                          return (
                            <h3 key={idx} className="text-sm font-semibold text-white pt-4 pb-1">
                              {t.label.replace(/^##\s*/, "")}
                            </h3>
                          );
                        }
                        return (
                          <p key={idx} className="text-xs text-slate-400 pl-1">
                            {t.label}
                          </p>
                        );
                      }

                      return (
                        <div
                          key={idx}
                          onClick={() => handleToggleTask(t.index, t.completed)}
                          className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer group ${
                            t.completed
                              ? "bg-emerald-500/5 border-emerald-500/10 text-slate-500"
                              : "bg-[#1c1c24] border-white/5 text-slate-200 hover:border-white/10 hover:bg-[#22222c]"
                          }`}
                        >
                          <div className="mt-0.5 shrink-0 transition-colors">
                            {t.completed ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
                            )}
                          </div>
                          <span className={`text-xs leading-relaxed font-sans ${t.completed ? "line-through" : ""}`}>
                            {t.label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Plan/Architecture Markdown Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-[#141419] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col h-fit">
                <h3 className="font-semibold text-sm text-slate-300 mb-4 pb-2 border-b border-white/5">
                  Plan Description & Architecture
                </h3>
                <div className="prose prose-invert prose-xs max-w-none text-slate-300 font-sans leading-relaxed overflow-x-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{planContent}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showInitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 font-sans">
          <div className="bg-[#121217] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <ClipboardList className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Initialize Project Plan</h3>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Describe what application, feature, or bug fix you want to build/resolve. Devy will construct a detailed roadmap and checklist based on your description.
            </p>

            <form onSubmit={handleConfirmInitialize} className="flex flex-col gap-4">
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="e.g., Build a personal portfolio website with a contact form and modern Tailwind CSS design..."
                required
                className="w-full h-32 bg-[#1d1d26] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none border border-white/5 focus:border-emerald-500/50 transition-colors resize-none leading-relaxed"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowInitModal(false);
                    setProjectDescription("");
                  }}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold transition-colors flex-1 text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!projectDescription.trim()}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-black rounded-xl text-xs font-bold transition-colors flex-1 text-center shadow-lg shadow-emerald-500/10"
                >
                  Generate Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
