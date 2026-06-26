import { useState, useEffect, useRef } from "react";
import { useEventBus } from "../useEventBus";
import { Play, Square, Loader2, RefreshCw, Terminal, CheckCircle2, XCircle, BrainCircuit } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface DebugSession {
  id: string;
  command: string;
  status: "running" | "exited" | "failed";
  exitCode?: number;
  pid?: number;
}

interface DebuggerPanelProps {
  workspaceId: string;
}

export function DebuggerPanel({ workspaceId }: DebuggerPanelProps) {
  const [sessions, setSessions] = useState<DebugSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [command, setCommand] = useState<string>("node index.js");
  const [logs, setLogs] = useState<string>("");
  const [running, setRunning] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  
  // AI Debugging States
  const [aiAnalyzing, setAiAnalyzing] = useState<boolean>(false);
  const [aiSuggestions, setAiSuggestions] = useState<string>("");

  // Autopilot States
  const [autopilot, setAutopilotState] = useState<boolean>(false);
  const autopilotRef = useRef(false);
  const setAutopilot = (val: boolean) => {
    autopilotRef.current = val;
    setAutopilotState(val);
  };

  const [autopilotWorking, setAutopilotWorkingState] = useState<boolean>(false);
  const autopilotWorkingRef = useRef(false);
  const setAutopilotWorking = (val: boolean) => {
    autopilotWorkingRef.current = val;
    setAutopilotWorkingState(val);
  };

  const [retryCount, setRetryCount] = useState<number>(0);
  const retryCountRef = useRef(0);

  const logEndRef = useRef<HTMLDivElement>(null);

  const triggerAutopilotHealing = async (sessionId: string, currentLogs: string) => {
    if (autopilotWorkingRef.current) return;
    setAutopilotWorking(true);
    setAiAnalyzing(true);
    const attempt = retryCountRef.current + 1;
    setAiSuggestions(`🤖 **Autopilot Triggered!**\n\nAttempting recovery run ${attempt}/3.\n\nAnalyzing crash log and files...`);

    try {
      const systemPrompt = `You are an automated self-healing debugger. Your goal is to inspect a crash log, identify the single source code file causing the failure, locate the exact lines that contain the bug, and provide a direct text replacement.
      
      You MUST respond with a JSON object in this exact format (do not wrap in markdown):
      {
        "explanation": "Brief explanation of the bug and fix",
        "filePath": "src/filename.ts",
        "targetContent": "the exact lines in the file to replace, with correct indentation and spacing",
        "replacementContent": "the corrected lines of code to write in its place"
      }`;

      const prompt = `Command run: ${command}\n\nCrash Log Output:\n${currentLogs}\n\nPlease inspect the crash log, locate the error source file, and generate the JSON replacement.`;

      const settingsString = localStorage.getItem("agent_settings");
      const settings = settingsString ? JSON.parse(settingsString) : {};
      const geminiModel = settings.geminiModel || "gemini-2.5-flash";
      const clientApiKey = settings.geminiApiKey || "";

      const payload = {
        systemInstruction: {
          role: "user",
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }]
      };

      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: geminiModel,
          payload,
          clientApiKey
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to consult Gemini API");
      }

      const data = await res.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      text = text.replace(/^```json\n/i, "").replace(/```$/, "").trim();
      
      let parsedFix;
      try {
        parsedFix = JSON.parse(text);
      } catch (e) {
        console.error("AI returned invalid JSON:", text);
        throw new Error("AI did not return a valid JSON repair payload. Output: " + text);
      }

      if (!parsedFix.filePath || !parsedFix.targetContent || !parsedFix.replacementContent) {
        throw new Error("AI repair payload is missing required fields (filePath, targetContent, replacementContent).");
      }

      setAiSuggestions(`🤖 **Autopilot Recovery (Attempt ${attempt}/3)**\n\n**Diagnosis:** ${parsedFix.explanation}\n\n**File to patch:** \`${parsedFix.filePath}\`\n\n**Applying patch...**`);

      const replaceRes = await fetch("/api/fs/replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          path: parsedFix.filePath,
          targetContent: parsedFix.targetContent,
          replacementContent: parsedFix.replacementContent
        })
      });

      if (!replaceRes.ok) {
        const errData = await replaceRes.json();
        throw new Error(`Failed to apply patch: ${errData?.error || replaceRes.statusText}`);
      }

      const replaceData = await replaceRes.json();
      if (!replaceData.success) {
        throw new Error(`Failed to apply file replacement: ${replaceData.error || 'Unknown error'}`);
      }

      setAiSuggestions(`🤖 **Autopilot Recovery (Attempt ${attempt}/3)**\n\n**Diagnosis:** ${parsedFix.explanation}\n\n**Patch applied successfully to \`${parsedFix.filePath}\`!**\n\n**Restarting command \`${command}\`...**`);
      
      retryCountRef.current += 1;
      setRetryCount(retryCountRef.current);

      await new Promise(r => setTimeout(r, 2000));

      setAiSuggestions("");
      setAutopilotWorking(false);
      setAiAnalyzing(false);
      
      handleStart(true);
    } catch (e: any) {
      setAiSuggestions(`🤖 **Autopilot Failed to Heal:** ${e.message}\n\nManual intervention required.`);
      setAutopilotWorking(false);
      setAiAnalyzing(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/debug/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        if (data.sessions.length > 0 && !activeSessionId) {
          setActiveSessionId(data.sessions[data.sessions.length - 1].id);
        }
      }
    } catch (e) {
      console.error("Failed to load debug sessions", e);
    }
  };

  const getLogs = async (id: string) => {
    if (!id) return;
    try {
      const res = await fetch("/api/debug/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || "");
        
        setSessions((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, status: data.status, exitCode: data.exitCode } : s
          )
        );

        if (id === activeSessionId) {
          setRunning(data.status === "running");
        }
      }
    } catch (e) {
      console.error("Failed to fetch logs", e);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const { subscribe } = useEventBus(workspaceId);

  useEffect(() => {
    if (!activeSessionId) return;
    
    getLogs(activeSessionId);
    
    const unsubscribe = subscribe('debug:log', (data) => {
      if (data && data.sessionId === activeSessionId) {
        const currentLogs = data.logs || "";
        setLogs(currentLogs);
        
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId ? { ...s, status: data.status, exitCode: data.exitCode } : s
          )
        );

        if (data.status) {
          setRunning(data.status === "running");
        }

        const isFailed = data.status === "failed" || (data.status === "exited" && data.exitCode !== undefined && data.exitCode !== 0);
        if (isFailed && autopilotRef.current && !autopilotWorkingRef.current && retryCountRef.current < 3) {
          triggerAutopilotHealing(activeSessionId, currentLogs);
        }
      }
    });

    return unsubscribe;
  }, [activeSessionId, subscribe]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleStart = async (isAutopilotRestart = false) => {
    if (!command.trim()) return;
    setLoading(true);
    if (!isAutopilotRestart) {
      setAiSuggestions("");
      retryCountRef.current = 0;
      setRetryCount(0);
    }
    try {
      const res = await fetch("/api/debug/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, command }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setActiveSessionId(data.sessionId);
          setRunning(true);
          await fetchSessions();
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleKill = async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch("/api/debug/kill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSessionId }),
      });
      if (res.ok) {
        setRunning(false);
        getLogs(activeSessionId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // AI Debugging Logic
  const handleAiDebug = async () => {
    if (!logs) return;
    setAiAnalyzing(true);
    setAiSuggestions("");
    try {
      const systemPrompt = "You are an expert debugger and senior software developer. You will diagnose stack traces, script crashes, and syntax errors, and supply highly accurate code fixes.";
      const prompt = `Below is the command executed and its console output/logs which contains an error or crash.
Command: ${command}

Logs:
${logs}

Analyze the error. Explain:
1. What went wrong (root cause).
2. How to fix it.
3. Provide the exact corrected code block(s) with clear markdown styling. Make it clear and directly applicable.`;

      const settingsString = localStorage.getItem("agent_settings");
      const settings = settingsString ? JSON.parse(settingsString) : {};
      const geminiModel = settings.geminiModel || "gemini-2.5-flash";
      const clientApiKey = settings.geminiApiKey || "";

      const payload = {
        systemInstruction: {
          role: "user",
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }]
      };

      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: geminiModel,
          payload,
          clientApiKey
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to consult Gemini API");
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No diagnostics generated.";
      setAiSuggestions(text);
    } catch (e: any) {
      setAiSuggestions(`Error calling Gemini for debug: ${e.message}. Make sure your Gemini API Key is entered in settings.`);
    } finally {
      setAiAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0e0e11] text-slate-300">
      {/* Top control bar */}
      <div className="p-4 border-b border-white/5 bg-[#141419] flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold text-white uppercase tracking-wider">
            Interactive Script Debugger
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181820] hover:bg-[#20202b] border border-white/5 rounded-lg select-none cursor-pointer transition-colors text-xs text-emerald-400 font-semibold mr-1">
            <input
              type="checkbox"
              checked={autopilot}
              onChange={(e) => setAutopilot(e.target.checked)}
              className="accent-emerald-500 rounded cursor-pointer"
            />
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>Autopilot</span>
          </label>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            disabled={running}
            placeholder="e.g. node index.js, python script.py"
            className="bg-[#18181f] text-xs text-white border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 w-64 font-mono"
          />
          {running ? (
            <button
              onClick={handleKill}
              className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" /> Stop
            </button>
          ) : (
            <button
              onClick={() => handleStart(false)}
              disabled={loading || !command.trim()}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              Run Debug
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sessions Sidebar */}
        <div className="w-48 border-r border-white/5 bg-[#0b0b0e] flex flex-col shrink-0">
          <div className="p-3 border-b border-white/5 text-[10px] uppercase font-bold text-slate-500 tracking-wider flex justify-between items-center">
            <span>Sessions</span>
            <button onClick={fetchSessions} className="hover:text-white transition-colors p-0.5">
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.length === 0 ? (
              <div className="text-center py-6 text-slate-600 text-xs font-mono">
                No active runs
              </div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSessionId(s.id);
                    getLogs(s.id);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-mono flex items-center justify-between border transition-all ${
                    s.id === activeSessionId
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-medium"
                      : "bg-transparent border-transparent text-slate-400 hover:bg-white/5"
                  }`}
                >
                  <span className="truncate max-w-[100px]">{s.command}</span>
                  {s.status === "running" && (
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                  )}
                  {s.status === "exited" && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  )}
                  {s.status === "failed" && (
                    <XCircle className="w-3 h-3 text-rose-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Debugger Output */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Output Terminal window */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#09090b]">
            <div className="p-2.5 border-b border-white/5 bg-[#0b0b0e] flex justify-between items-center text-xs">
              <span className="text-slate-400 font-mono">Terminal Outputs</span>
              {logs && (
                <button
                  onClick={handleAiDebug}
                  disabled={aiAnalyzing}
                  className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-md flex items-center gap-1.5 transition-all text-[11px]"
                >
                  {aiAnalyzing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <BrainCircuit className="w-3.5 h-3.5" />
                  )}
                  Debug with AI
                </button>
              )}
            </div>
            <div className="flex-1 p-4 font-mono text-[12px] leading-relaxed overflow-y-auto whitespace-pre-wrap select-text selection:bg-emerald-500/30">
              {logs ? (
                logs
              ) : (
                <span className="text-slate-600 italic">No output logs yet. Select or start a debug session.</span>
              )}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* AI Debug Suggestions Panel */}
          {(aiSuggestions || aiAnalyzing) && (
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-white/5 bg-[#0e0e11] flex flex-col overflow-hidden shrink-0">
              <div className="p-3 border-b border-white/5 bg-[#141419] flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <BrainCircuit className="w-4 h-4" />
                <span>AI Agent Diagnosis</span>
              </div>
              <div className="flex-1 p-4 overflow-y-auto text-xs leading-relaxed markdown-body select-text">
                {aiAnalyzing ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500 font-mono">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    <span>Analyzing logs & stack trace...</span>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-xs max-w-none">
                    <ReactMarkdown>{aiSuggestions}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
