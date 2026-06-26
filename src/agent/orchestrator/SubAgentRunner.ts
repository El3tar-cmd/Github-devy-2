import { SubAgentDefinition } from "../types/AgentTypes";
import { ChatMessage, Settings } from "../../types";
import { submitGeminiRequest } from "../../geminiApi";
import { summarizeHistory } from "../summarizeHistory";

// Trigger summarization when message count exceeds this
const SUMMARY_TRIGGER = 12;
// Keep this many recent messages un-summarized
const KEEP_RECENT = 6;

function sanitizeMessagesForLLM(msgs: ChatMessage[]): ChatMessage[] {
  return msgs.map((m) => {
    if (!m.toolInvocations) return m;
    return {
      ...m,
      toolInvocations: m.toolInvocations.map((inv) => {
        if (inv.name === "browser_screenshot" && inv.result) {
          try {
            const parsed = JSON.parse(inv.result);
            if (parsed.screenshot) {
              return { ...inv, result: JSON.stringify({ ...parsed, screenshot: "[IMAGE DETACHED]" }) };
            }
          } catch { /* ignore */ }
        }
        // Truncate oversized tool results to prevent context overflow
        if (inv.result && inv.result.length > 4000) {
          return { ...inv, result: inv.result.slice(0, 4000) + "\n...[truncated for context]" };
        }
        return inv;
      }),
    };
  });
}

export async function runSubAgent(
  definition: SubAgentDefinition,
  task: string,
  settings: Settings,
  workspaceId: string,
  toolsSchema: any[],
  executeToolCallFn: any,
  onProgress?: (status: string, messages: ChatMessage[]) => void,
  signal?: AbortSignal,
  customMaxIterations?: number
): Promise<{ result: string; messages: ChatMessage[] }> {

  const allowedToolSchema = toolsSchema.filter(
    (t) => definition.allowedTools.includes(t.function.name)
  );

  const messages: ChatMessage[] = [
    { id: Math.random().toString(36).substring(7), role: "user", content: task }
  ];

  let iterations = 0;
  const maxLimit = customMaxIterations || definition.maxIterations;
  let historySummary = "";

  while (iterations < maxLimit) {
    if (signal?.aborted) throw new Error("Sub-agent aborted");
    iterations++;

    // --- Context window management: summarize old messages ---
    if (messages.length > SUMMARY_TRIGGER) {
      const toSummarize = messages.slice(0, -KEEP_RECENT);
      try {
        onProgress?.(`${definition.name}: compressing context (${toSummarize.length} msgs → summary)`, messages);
        const newSummary = await summarizeHistory(
          historySummary
            ? [{ id: "prev", role: "assistant" as const, content: `[Previous summary]: ${historySummary}` }, ...toSummarize]
            : toSummarize,
          settings,
          signal
        );
        historySummary = newSummary;
        // Replace old messages with the summary marker — keep only recent ones
        messages.splice(0, messages.length - KEEP_RECENT);
      } catch (err) {
        console.error("Sub-agent summarization failed, continuing without compression:", err);
      }
    }

    onProgress?.(`${definition.name}: iteration ${iterations}/${maxLimit}`, messages);

    // Build system prompt with history summary if available
    const systemPrompt = historySummary
      ? `${definition.systemPrompt}\n\n[PRIOR CONTEXT SUMMARY — use this to understand what you have already done]:\n${historySummary}`
      : definition.systemPrompt;

    let responseMsg: any;
    const sanitizedMessages = sanitizeMessagesForLLM(messages);

    if (settings.apiProvider === "gemini") {
      // Inject summary into system via a synthetic leading message for Gemini
      const msgsWithContext: ChatMessage[] = historySummary
        ? [{ id: "ctx", role: "system" as any, content: `[Context from earlier in this task]:\n${historySummary}` }, ...sanitizedMessages]
        : sanitizedMessages;

      const data = await submitGeminiRequest(
        settings.geminiApiKey || "",
        definition.model || settings.geminiModel || "gemini-2.5-flash",
        systemPrompt,
        sanitizedMessages,
        signal!
      );
      responseMsg = data.message;
    } else {
      // Ollama
      const payloadMessages = [
        { role: "system", content: systemPrompt },
        ...sanitizedMessages.flatMap<any>((m) => {
          if (m.role === "tool") {
            return m.toolInvocations?.map((inv) => ({
              role: "tool", content: inv.result, name: inv.name,
            })) || [];
          }
          if (m.role === "assistant" && m.toolInvocations?.length) {
            return [{
              role: "assistant",
              content: m.content || "",
              tool_calls: m.toolInvocations.map((inv) => ({
                type: "function",
                function: { name: inv.name, arguments: inv.args },
              })),
            }];
          }
          return [{ role: m.role, content: m.content || "" }];
        }),
      ];

      const baseUrl = settings.ollamaUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: definition.model || settings.ollamaModel,
          messages: payloadMessages,
          stream: false,
          tools: allowedToolSchema,
          options: { num_predict: 4096, temperature: definition.temperature ?? 0.7 },
        }),
        signal,
      });

      if (!res.ok) throw new Error(`Sub-agent API Error: ${res.status}`);
      const data = await res.json();
      responseMsg = data.message;
    }

    // --- Process tool calls ---
    if (responseMsg.tool_calls?.length > 0) {
      const invocations = responseMsg.tool_calls.map((tc: any) => ({
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
      messages.push(asstMsg);
      onProgress?.(`${definition.name}: ${invocations.length} tool call(s)`, messages);

      for (const inv of invocations) {
        if (!definition.allowedTools.includes(inv.name)) {
          inv.result = JSON.stringify({ error: `Tool "${inv.name}" is not allowed for ${definition.name}` });
          inv.status = "error";
          onProgress?.(`${definition.name}: blocked disallowed tool ${inv.name}`, messages);
          continue;
        }
        try {
          onProgress?.(`${definition.name}: ${inv.name}`, messages);
          const result = await executeToolCallFn(
            inv.name, inv.args, workspaceId, settings,
            (chunk: string) => {
              inv.result = typeof chunk === "string" ? chunk : JSON.stringify(chunk);
              onProgress?.(`${definition.name}: streaming ${inv.name}`, messages);
            },
            signal
          );
          inv.result = typeof result === "string" ? result : JSON.stringify(result);
          inv.status = "success";
        } catch (err: any) {
          inv.result = JSON.stringify({ error: err.message });
          inv.status = "error";
          onProgress?.(`${definition.name}: ${inv.name} failed`, messages);
        }
      }

      messages.push({ id: Math.random().toString(36), role: "tool", content: "", toolInvocations: invocations });
      onProgress?.(`${definition.name}: tools done`, messages);

    } else {
      // Final answer — agent is done
      messages.push({
        id: Math.random().toString(36),
        role: "assistant",
        content: responseMsg.content,
        geminiParts: responseMsg.geminiParts,
      });
      onProgress?.(`${definition.name}: task complete`, messages);
      return { result: responseMsg.content, messages };
    }
  }

  return {
    result: `Sub-agent ${definition.name} reached maximum iterations (${maxLimit})`,
    messages,
  };
}
