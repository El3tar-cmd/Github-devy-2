import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMessage, Settings, ChatSession } from "./types";
import { TOOLS_SCHEMA, executeToolCall, fetchOllamaModels } from "./ollama";
import { submitGeminiRequest } from "./geminiApi";

export function useAgent(
  settings: Settings,
  workspaceId: string,
  onSettingsUpdate?: (s: Partial<Settings>, newWorkspaceId?: string) => void,
) {
  // Session Persistence
  const getInitialSessions = () => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("agent_sessions");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  };

  const [sessions, setSessions] = useState<ChatSession[]>(getInitialSessions);

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("current_session_id");
      if (saved) return saved;
    }
    return Math.random().toString(36).substring(7);
  });

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("agent_sessions", JSON.stringify(sessions));
    } else {
      localStorage.removeItem("agent_sessions");
    }
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem("current_session_id", currentSessionId);
  }, [currentSessionId]);

  const [isRunning, setIsRunning] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const abortAgent = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRunning(false);
  };

  const loadModels = useCallback(async () => {
    if (!settings.ollamaUrl) return;
    setModelsError(null);
    const { models: m, error } = await fetchOllamaModels(settings.ollamaUrl);
    setModels(m);
    if (error) setModelsError(error);
  }, [settings.ollamaUrl]);

  const currentSession = sessions.find((s) => s.id === currentSessionId) || {
    id: currentSessionId,
    title: "New Chat",
    messages: [],
    updatedAt: Date.now(),
  };
  const messages = currentSession.messages;

  // Safe Session Updater to avoid async closures referencing old IDs point to the wrong session
  const createSessionUpdater = useCallback((targetId: string) => {
    return (updater: ChatMessage[] | ((p: ChatMessage[]) => ChatMessage[])) => {
      setSessions((prev: ChatSession[]) => {
        const current = prev.find((s: ChatSession) => s.id === targetId) || {
          id: targetId,
          title: "New Chat",
          messages: [],
          updatedAt: Date.now(),
        };
        const newMessages =
          typeof updater === "function" ? updater(current.messages) : updater;

        let title = current.title;
        if (newMessages.length > 0 && (title === "New Chat" || title === "")) {
          const firstUser = newMessages.find((m) => m.role === "user");
          if (firstUser && firstUser.content) {
            title =
              firstUser.content.substring(0, 30) +
              (firstUser.content.length > 30 ? "..." : "");
          }
        }

        const updatedSession = {
          ...current,
          messages: newMessages,
          title,
          updatedAt: Date.now(),
        };
        const filtered = prev.filter((s) => s.id !== targetId);
        return [updatedSession, ...filtered].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        );
      });
    };
  }, []);

  const setMessagesForCurrent = useCallback(
    (updater: ChatMessage[] | ((p: ChatMessage[]) => ChatMessage[])) => {
      createSessionUpdater(currentSessionId)(updater);
    },
    [currentSessionId, createSessionUpdater],
  );

  const runAgentLoop = async (
    currentMessages: ChatMessage[],
    updateLog: ReturnType<typeof createSessionUpdater>,
  ) => {
    setIsRunning(true);
    let iterMessages = [...currentMessages];

    // Create new abort controller
    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      while (true) {
        if (ac.signal.aborted) throw new Error("Aborted by user.");

        const systemPrompt =
          settings.systemPrompt || "You are an AI assistant.";

        let responseMsg: any;

        if (settings.apiProvider === "gemini") {
          const data = await submitGeminiRequest(
            settings.geminiApiKey || "",
            settings.geminiModel || "gemini-2.5-flash",
            systemPrompt,
            iterMessages,
            ac.signal,
          );
          responseMsg = data.message;
        } else {
          // Ollama Flow
          const payloadMessages = [
            { role: "system", content: systemPrompt },
            ...iterMessages.flatMap<any>((m) => {
              if (m.role === "tool") {
                return (
                  m.toolInvocations?.map((inv) => ({
                    role: "tool",
                    content: inv.result,
                    name: inv.name,
                  })) || []
                );
              }
              if (m.role === "assistant" && m.toolInvocations?.length) {
                return [
                  {
                    role: "assistant",
                    content: m.content || "",
                    tool_calls: m.toolInvocations.map((inv) => ({
                      type: "function",
                      function: {
                        name: inv.name,
                        arguments: inv.args,
                      },
                    })),
                  },
                ];
              }
              return [{ role: m.role, content: m.content || "" }];
            }),
          ];

          const baseUrl = settings.ollamaUrl.replace(/\/+$/, "");
          const res = await fetch(`${baseUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: settings.ollamaModel,
              messages: payloadMessages,
              stream: false,
              tools: TOOLS_SCHEMA,
            }),
            signal: ac.signal,
          });

          if (!res.ok) {
            throw new Error(
              `API Error: ${(await res.text()).substring(0, 500)}`,
            );
          }

          const data = await res.json();
          responseMsg = data.message;
        }

        if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
          const rawInvs = responseMsg.tool_calls;
          const invocations = rawInvs.map((tc: any) => ({
            id: Math.random().toString(36).substring(7),
            name: tc.function.name,
            args: tc.function.arguments,
            status: "running" as const,
          }));

          const asstMsg: ChatMessage = {
            id: Math.random().toString(36),
            role: "assistant",
            content: responseMsg.content || "",
            toolInvocations: invocations,
            geminiParts: responseMsg.geminiParts,
          };

          updateLog((prev) => [...prev, asstMsg]);
          iterMessages = [...iterMessages, asstMsg];

          const completedInvocations = [...invocations];

          for (let i = 0; i < completedInvocations.length; i++) {
            const inv = completedInvocations[i];
            try {
              if (ac.signal.aborted) throw new Error("Aborted by user.");
              const result = await executeToolCall(
                inv.name,
                inv.args,
                workspaceId,
                (chunkStr) => {
                  completedInvocations[i].result =
                    typeof chunkStr === "string"
                      ? chunkStr
                      : JSON.stringify(chunkStr);
                  updateLog((prev) => {
                    const copy = [...prev];
                    const msgIdx = copy.findIndex((m) => m.id === asstMsg.id);
                    if (msgIdx !== -1) {
                      copy[msgIdx] = {
                        ...copy[msgIdx],
                        toolInvocations: [...completedInvocations],
                      };
                    }
                    return copy;
                  });
                },
                ac.signal,
              );
              completedInvocations[i].result =
                typeof result === "string" ? result : JSON.stringify(result);
              completedInvocations[i].status = "success";
              if (inv.name === "clone_git_repository") {
                if (result && (result.success || !result.error)) {
                  onSettingsUpdate?.(
                    {
                      repoUrl: inv.args.repoUrl,
                      githubToken: inv.args.token || "",
                    },
                    result.workspaceId,
                  );
                }
              }
            } catch (err: any) {
              if (err.name === "AbortError")
                throw new Error("Aborted by user.");
              completedInvocations[i].result = JSON.stringify({
                error: err.message,
              });
              completedInvocations[i].status = "error";
            }

            updateLog((prev) => {
              const copy = [...prev];
              const msgIdx = copy.findIndex((m) => m.id === asstMsg.id);
              if (msgIdx !== -1) {
                copy[msgIdx] = {
                  ...copy[msgIdx],
                  toolInvocations: [...completedInvocations],
                };
              }
              return copy;
            });
          }

          const toolResultMsg: ChatMessage = {
            id: Math.random().toString(36),
            role: "tool",
            content: "",
            toolInvocations: completedInvocations,
          };
          updateLog((prev) => [...prev, toolResultMsg]);
          iterMessages = [...iterMessages, toolResultMsg];
        } else {
          const finalMsg: ChatMessage = {
            id: Math.random().toString(36),
            role: "assistant",
            content: responseMsg.content,
            geminiParts: responseMsg.geminiParts,
          };
          updateLog((prev) => [...prev, finalMsg]);
          break;
        }
      }
    } catch (e: any) {
      updateLog((prev) => [
        ...prev,
        {
          id: Math.random().toString(36),
          role: "system",
          content: `Error: ${e.message}`,
        },
      ]);
    } finally {
      if (abortControllerRef.current === ac) abortControllerRef.current = null;
      setIsRunning(false);
    }
  };

  const sendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: Math.random().toString(36),
      role: "user",
      content: text,
    };

    // Bind the background loop specifically to the session ID active right now.
    const activeId = currentSessionId;
    const boundedUpdater = createSessionUpdater(activeId);

    boundedUpdater((prev) => {
      const updated = [...prev, userMsg];
      setTimeout(() => runAgentLoop(updated, boundedUpdater), 0);
      return updated;
    });
  };

  const clearMessages = () => setMessagesForCurrent([]);

  const startNewChat = () => {
    setCurrentSessionId(Math.random().toString(36).substring(7));
  };

  const switchSession = (id: string) => {
    setCurrentSessionId(id);
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(Math.random().toString(36).substring(7));
    }
  };

  return {
    messages,
    sendMessage,
    isRunning,
    clearMessages,
    models,
    modelsError,
    loadModels,
    sessions,
    currentSessionId,
    startNewChat,
    switchSession,
    deleteSession,
    abortAgent,
  };
}
