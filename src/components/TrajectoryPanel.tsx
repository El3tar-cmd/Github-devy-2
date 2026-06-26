import { useState, useMemo } from "react";
import { useAgentContext } from "../contexts/AgentContext";
import { 
  GitCommit, 
  BrainCircuit, 
  Terminal, 
  Cpu, 
  ChevronDown, 
  ChevronRight, 
  Coins, 
  Copy, 
  Check, 
  Clock, 
  AlertTriangle 
} from "lucide-react";

interface TrajectoryStep {
  id: string;
  index: number;
  thought: string;
  toolCalls: Array<{
    id: string;
    name: string;
    args: any;
    result?: string;
    status: "running" | "success" | "error";
  }>;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

export function TrajectoryPanel() {
  const { messages } = useAgentContext();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  // Parse messages into a list of trajectory steps
  const steps = useMemo(() => {
    const list: TrajectoryStep[] = [];
    let stepIndex = 1;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      // Assistant messages that initiated tool calls or had content
      if (msg.role === "assistant") {
        const hasTools = msg.toolInvocations && msg.toolInvocations.length > 0;
        
        list.push({
          id: msg.id,
          index: stepIndex++,
          thought: msg.content || "",
          toolCalls: msg.toolInvocations ? msg.toolInvocations.map(inv => ({
            id: inv.id,
            name: inv.name,
            args: inv.args,
            result: inv.result,
            status: inv.status
          })) : [],
          inputTokens: msg.inputTokens,
          outputTokens: msg.outputTokens,
          costUsd: msg.costUsd
        });
      }
      
      // If we encounter a tool message, it might contain results for a preceding running tool
      if (msg.role === "tool" && msg.toolInvocations && list.length > 0) {
        const lastStep = list[list.length - 1];
        msg.toolInvocations.forEach(toolInv => {
          const matchingTool = lastStep.toolCalls.find(tc => tc.id === toolInv.id);
          if (matchingTool) {
            matchingTool.result = toolInv.result;
            matchingTool.status = toolInv.status;
          }
        });
      }
    }
    return list;
  }, [messages]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    let totalToolCalls = 0;

    steps.forEach(s => {
      totalInputTokens += s.inputTokens || 0;
      totalOutputTokens += s.outputTokens || 0;
      totalCost += s.costUsd || 0;
      totalToolCalls += s.toolCalls.length;
    });

    return {
      totalInputTokens,
      totalOutputTokens,
      totalCost,
      totalToolCalls
    };
  }, [steps]);

  const toggleStep = (id: string) => {
    setExpandedSteps(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleTool = (id: string) => {
    setExpandedTools(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0d] text-slate-300 overflow-hidden font-sans">
      {/* Header Stat Panel */}
      <div className="p-4 border-b border-white/5 bg-[#0f0f14] flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-sm font-semibold text-white">Agent Trajectory Trace</h2>
            <p className="text-[10px] text-slate-500 font-mono">Thought ➔ Action ➔ Observation Replay</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-purple-400" />
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Steps / Tools</span>
              <span className="text-white font-semibold">{steps.length} / {stats.totalToolCalls}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-400" />
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Total Tokens</span>
              <span className="text-white font-semibold">{(stats.totalInputTokens + stats.totalOutputTokens).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Total Cost (Gemini)</span>
              <span className="text-emerald-400 font-semibold">${stats.totalCost.toFixed(5)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trajectory Timeline Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {steps.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-3 border border-dashed border-white/5 rounded-2xl bg-[#0d0d12]">
            <BrainCircuit className="w-10 h-10 text-slate-600 animate-pulse" />
            <span className="text-sm">No agent thoughts or actions recorded in this session.</span>
            <span className="text-xs text-slate-600">Send a message to the agent to start tracking.</span>
          </div>
        ) : (
          <div className="relative border-l border-white/10 pl-6 ml-4 space-y-8">
            {steps.map((step) => {
              const isStepExpanded = expandedSteps[step.id] !== false; // Default expanded
              return (
                <div key={step.id} className="relative group">
                  {/* Timeline Node Icon */}
                  <div className="absolute -left-[35px] top-1.5 bg-[#0a0a0d] border-2 border-emerald-500/40 group-hover:border-emerald-400 rounded-full p-1 text-emerald-400 transition-colors shadow-lg">
                    <span className="text-[9px] w-4 h-4 flex items-center justify-center font-bold font-mono">
                      {step.index}
                    </span>
                  </div>

                  {/* Step Card */}
                  <div className="bg-[#0f0f15] border border-white/5 rounded-xl overflow-hidden shadow-xl transition-all hover:border-white/10">
                    {/* Collapsible Header */}
                    <div 
                      onClick={() => toggleStep(step.id)}
                      className="p-4 bg-[#14141c] flex items-center justify-between cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                          Iteration Step {step.index}
                        </span>
                        {step.toolCalls.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 font-mono">
                            {step.toolCalls.length} tool call{step.toolCalls.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {(step.inputTokens || step.outputTokens) && (
                          <span className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded-full border border-purple-500/20 font-mono hidden sm:inline">
                            {(step.inputTokens || 0) + (step.outputTokens || 0)} tkn
                          </span>
                        )}
                        {step.costUsd !== undefined && step.costUsd > 0 && (
                          <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-300 rounded-full border border-emerald-500/20 font-mono hidden sm:inline">
                            ${step.costUsd.toFixed(5)}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400">
                        {isStepExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </div>

                    {/* Collapsible Body */}
                    {isStepExpanded && (
                      <div className="p-4 space-y-4">
                        {/* Thought block */}
                        {step.thought && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
                              <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                              <span>Thought Formulation</span>
                            </div>
                            <div className="p-3.5 rounded-lg bg-[#181822] text-xs leading-relaxed text-slate-200 border border-white/5 font-sans whitespace-pre-wrap">
                              {step.thought}
                            </div>
                          </div>
                        )}

                        {/* Tool Calls & Results */}
                        {step.toolCalls.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
                              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Actions Taken (Tools)</span>
                            </div>

                            <div className="space-y-3">
                              {step.toolCalls.map((tool) => {
                                const isToolExpanded = expandedTools[tool.id] !== false; // Default expanded
                                return (
                                  <div key={tool.id} className="border border-white/5 rounded-lg overflow-hidden bg-[#0a0a0d]">
                                    {/* Tool Header */}
                                    <div 
                                      onClick={() => toggleTool(tool.id)}
                                      className="px-3 py-2 bg-[#12121b] border-b border-white/5 flex items-center justify-between cursor-pointer select-none"
                                    >
                                      <div className="flex items-center gap-2">
                                        <GitCommit className={`w-3.5 h-3.5 ${
                                          tool.status === 'success' ? 'text-emerald-500' :
                                          tool.status === 'error' ? 'text-rose-500' : 'text-amber-500 animate-pulse'
                                        }`} />
                                        <span className="text-xs font-mono font-bold text-white">
                                          {tool.name}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                                          tool.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                                          tool.status === 'error' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400 animate-pulse'
                                        }`}>
                                          {tool.status}
                                        </span>
                                        {isToolExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                      </div>
                                    </div>

                                    {/* Tool Body */}
                                    {isToolExpanded && (
                                      <div className="p-3 space-y-3 divide-y divide-white/5">
                                        {/* Arguments */}
                                        <div className="space-y-1.5">
                                          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Parameters</span>
                                          <pre className="p-2 rounded bg-[#101017] text-[10px] font-mono overflow-x-auto text-purple-300 border border-white/5">
                                            {JSON.stringify(tool.args, null, 2)}
                                          </pre>
                                        </div>

                                        {/* Observation / Result */}
                                        <div className="pt-2.5 space-y-1.5">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-slate-500 font-semibold uppercase">Observation (Output)</span>
                                            {tool.result && (
                                              <button 
                                                onClick={() => handleCopy(tool.result || "", tool.id)}
                                                className="hover:text-white transition-colors p-1 text-slate-500"
                                                title="Copy output"
                                              >
                                                {copiedId === tool.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                              </button>
                                            )}
                                          </div>
                                          {tool.result ? (
                                            tool.status === 'error' ? (
                                              <div className="p-2.5 rounded border border-rose-500/20 bg-rose-500/5 text-rose-400 text-[10px] font-mono whitespace-pre-wrap flex gap-2">
                                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                                <span>{tool.result}</span>
                                              </div>
                                            ) : (
                                              <pre className="p-2.5 rounded bg-[#07070a] text-[10px] font-mono overflow-auto max-h-48 border border-white/5 text-emerald-400 whitespace-pre-wrap">
                                                {tool.result}
                                              </pre>
                                            )
                                          ) : (
                                            <span className="text-[10px] text-slate-600 italic">No output result recorded.</span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
