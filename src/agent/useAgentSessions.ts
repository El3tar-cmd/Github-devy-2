import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMessage, ChatSession } from "../types";

const MAX_STORED_SESSIONS = 20;
const MAX_TOOL_RESULT_CHARS = 20000;
const DEFAULT_WORKSPACE_KEY = "__default__";

function getWorkspaceStorageKey(workspaceId: string, key: string) {
  return `${key}_${workspaceId || DEFAULT_WORKSPACE_KEY}`;
}

function generateSessionId() {
  return Math.random().toString(36).substring(7);
}

function sanitizeToolResult(result?: string) {
  if (!result) return result;

  try {
    const parsed = JSON.parse(result);
    if (typeof parsed?.screenshot === "string" && parsed.screenshot.startsWith("data:image/")) {
      return JSON.stringify({
        ...parsed,
        screenshot: undefined,
        screenshotOmitted: true,
      });
    }
  } catch (e) {}

  if (result.length > MAX_TOOL_RESULT_CHARS) {
    return `${result.slice(0, MAX_TOOL_RESULT_CHARS)}\n...[truncated for local storage]`;
  }

  return result;
}

function sanitizeSessionsForStorage(sessions: ChatSession[]) {
  return sessions.slice(0, MAX_STORED_SESSIONS).map((session) => ({
    ...session,
    messages: session.messages.map((message) => ({
      ...message,
      toolInvocations: message.toolInvocations?.map((invocation) => ({
        ...invocation,
        result: sanitizeToolResult(invocation.result),
      })),
    })),
  }));
}

export function useAgentSessions(workspaceId: string) {
  // Session Persistence
  const getInitialSessions = (targetWorkspaceId = workspaceId) => {
    if (typeof window === "undefined") return [];
    const scopedKey = getWorkspaceStorageKey(targetWorkspaceId, "agent_sessions");
    const saved = localStorage.getItem(scopedKey) || localStorage.getItem("agent_sessions");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  };

  const [sessions, setSessions] = useState<ChatSession[]>(getInitialSessions);

  const getInitialCurrentSessionId = (targetWorkspaceId = workspaceId) => {
    if (typeof window !== "undefined") {
      const scopedKey = getWorkspaceStorageKey(targetWorkspaceId, "current_session_id");
      const saved = localStorage.getItem(scopedKey) || localStorage.getItem("current_session_id");
      if (saved) return saved;
    }
    return generateSessionId();
  };

  const [currentSessionId, setCurrentSessionId] = useState<string>(getInitialCurrentSessionId);
  const previousWorkspaceIdRef = useRef(workspaceId);
  const skipNextSessionPersistRef = useRef(false);
  const skipNextCurrentPersistRef = useRef(false);

  useEffect(() => {
    if (previousWorkspaceIdRef.current === workspaceId) return;

    previousWorkspaceIdRef.current = workspaceId;
    skipNextSessionPersistRef.current = true;
    skipNextCurrentPersistRef.current = true;
    setSessions(getInitialSessions(workspaceId));
    setCurrentSessionId(getInitialCurrentSessionId(workspaceId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  useEffect(() => {
    if (skipNextSessionPersistRef.current) {
      skipNextSessionPersistRef.current = false;
      return;
    }

    const scopedKey = getWorkspaceStorageKey(workspaceId, "agent_sessions");
    try {
      if (sessions.length > 0) {
        localStorage.setItem(scopedKey, JSON.stringify(sanitizeSessionsForStorage(sessions)));
      } else {
        localStorage.removeItem(scopedKey);
      }
    } catch (err: any) {
      if (err?.name === "QuotaExceededError") {
        try {
          localStorage.setItem(scopedKey, JSON.stringify(sanitizeSessionsForStorage(sessions.slice(0, 5))));
        } catch (fallbackErr) {
          console.warn("Failed to persist agent sessions after trimming.", fallbackErr);
        }
      } else {
        console.warn("Failed to persist agent sessions.", err);
      }
    }
  }, [sessions, workspaceId]);

  useEffect(() => {
    if (skipNextCurrentPersistRef.current) {
      skipNextCurrentPersistRef.current = false;
      return;
    }
    localStorage.setItem(getWorkspaceStorageKey(workspaceId, "current_session_id"), currentSessionId);
  }, [currentSessionId, workspaceId]);

  // Keep a ref to sessions for async closures (avoids stale closure bug)
  const sessionsRef = useRef<ChatSession[]>(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const currentSession = sessions.find((s) => s.id === currentSessionId) || {
    id: currentSessionId,
    title: "New Chat",
    messages: [],
    updatedAt: Date.now(),
  };
  const messages = currentSession.messages;

  const createEmptySession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const existing = prev.find((s) => s.id === sessionId);
      if (existing) return prev;

      const newSession: ChatSession = {
        id: sessionId,
        title: "New Chat",
        messages: [],
        updatedAt: Date.now(),
      };

      return [newSession, ...prev].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, []);

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
          title: newMessages.length === 0 ? "New Chat" : title,
          updatedAt: Date.now(),
          ...(newMessages.length === 0 ? { historySummary: "", summarizedCount: 0 } : {})
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

  const clearMessages = () => setMessagesForCurrent([]);

  const startNewChat = () => {
    const newSessionId = generateSessionId();
    createEmptySession(newSessionId);
    setCurrentSessionId(newSessionId);
  };

  const switchSession = (id: string) => {
    if (!sessionsRef.current.some((s) => s.id === id)) {
      createEmptySession(id);
    }
    setCurrentSessionId(id);
  };

  const deleteSession = useCallback((id: string) => {
    const remaining = sessionsRef.current.filter((s) => s.id !== id);

    if (remaining.length === 0) {
      const replacementId = generateSessionId();
      const replacementSession: ChatSession = {
        id: replacementId,
        title: "New Chat",
        messages: [],
        updatedAt: Date.now(),
      };

      setSessions([replacementSession]);
      if (currentSessionId === id) {
        setCurrentSessionId(replacementId);
      }
      return;
    }

    setSessions(remaining);
    if (currentSessionId === id) {
      setCurrentSessionId(remaining[0].id);
    }
  }, [currentSessionId]);

  return {
    sessions,
    setSessions,
    sessionsRef,
    currentSessionId,
    currentSession,
    messages,
    createSessionUpdater,
    setMessagesForCurrent,
    clearMessages,
    startNewChat,
    switchSession,
    deleteSession,
  };
}
