import React, { useState, useEffect, useRef } from "react";
import { Terminal, Loader2, ClipboardList, Send, Square } from "lucide-react";
import { useAgentContext } from "../../contexts/AgentContext";
import { ChatMessageUI } from "../ChatMessageUI";

interface ChatLayoutProps {
  activeTab: "chat" | "ide";
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ activeTab }) => {
  const {
    messages,
    sendMessage,
    isRunning,
    settings,
    setSettings,
    abortAgent,
  } = useAgentContext();

  const [inputStr, setInputStr] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollPaneRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const providerReady =
    settings.apiProvider === "ollama"
      ? Boolean(settings.ollamaModel)
      : settings.apiProvider === "lmstudio"
        ? Boolean(settings.lmStudioModel)
        : Boolean(settings.geminiApiKey);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isRunning]);

  const handleScroll = () => {
    const pane = scrollPaneRef.current;
    if (!pane) return;
    const distanceFromBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 140;
  };

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "0px";
    composer.style.height = `${Math.min(composer.scrollHeight, 160)}px`;
  }, [inputStr]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRunning) {
      abortAgent();
      return;
    }
    if (!inputStr.trim()) return;
    shouldStickToBottomRef.current = true;
    sendMessage(inputStr);
    setInputStr("");
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;

    if (e.shiftKey) {
      return;
    }

    if (e.nativeEvent.isComposing) {
      return;
    }

    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  };

  return (
    <div
      className={`flex-1 min-w-0 w-full flex flex-col relative h-full ${
        activeTab === "chat" ? "flex" : "hidden lg:flex"
      } lg:border-r border-white/5 bg-[#0b0b0e]`}
    >
      <div
        ref={scrollPaneRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 scroll-smooth pb-40"
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-4">
              <Terminal className="w-12 h-12 text-slate-700/50" />
              <p className="text-sm">Connect a repo and start tasking the agent.</p>
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
        <div className="flex items-center justify-between mb-2 bg-[#141419]/90 border border-white/5 px-4 py-2 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${settings.planModeActive ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)] animate-pulse" : "bg-slate-600"}`} />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-200">Plan Mode (نمط التخطيط)</span>
              <span className="text-[10px] text-slate-500">Auto-tracks progress in plan.md / tasks.md</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSettings((prev) => ({ ...prev, planModeActive: !prev.planModeActive }));
            }}
            className={`w-10 h-5 rounded-full transition-all relative border border-transparent ${
              settings.planModeActive ? "bg-emerald-500" : "bg-[#2a2a32]"
            }`}
          >
            <div
              className={`w-3.5 h-3.5 bg-black rounded-full absolute top-0.5 transition-all ${
                settings.planModeActive ? "left-5" : "left-1"
              }`}
            />
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="relative flex items-end bg-[#1e1e24] border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden transition-all focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:border-emerald-500/30"
        >
          <textarea
            ref={composerRef}
            value={inputStr}
            onChange={(e) => setInputStr(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            disabled={isRunning || !providerReady}
            placeholder={
              isRunning ? "Agent is working..." : "Ask the agent to modify code..."
            }
            rows={1}
            className="flex-1 min-h-[56px] max-h-40 resize-none bg-transparent py-4 pl-5 md:pl-6 pr-14 text-white outline-none placeholder-slate-500 disabled:opacity-50 text-sm leading-relaxed overflow-y-auto whitespace-pre-wrap"
          />
          <button
            type="submit"
            disabled={
              (!inputStr.trim() && !isRunning) ||
              !providerReady
            }
            className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all ${
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
  );
};
