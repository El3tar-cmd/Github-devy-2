import { SubAgentDefinition } from "../types/AgentTypes";
import { ChatMessage, Settings } from "../../types";
import { submitGeminiRequest } from "../../geminiApi";

function sanitizeMessagesForLLM(msgs: ChatMessage[]): ChatMessage[] {
  return msgs.map((m) => {
    if (m.toolInvocations) {
      const sanitizedInvs = m.toolInvocations.map((inv) => {
        if (inv.name === "browser_screenshot" && inv.result) {
          try {
            const parsed = JSON.parse(inv.result);
            if (parsed.screenshot) {
              parsed.screenshot = "[IMAGE DATA DETACHED - VIEW NATIVELY IN IDE CHAT VIEW]";
              return {
                ...inv,
                result: JSON.stringify(parsed)
              };
            }
          } catch (e) {
            // fallback
          }
        }
        return inv;
      });
      return {
        ...m,
        toolInvocations: sanitizedInvs
      };
    }
    return m;
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
  
  // Filter tools to only what this sub-agent is allowed to use
  const allowedToolSchema = toolsSchema.filter(
    (t) => definition.allowedTools.includes(t.function.name)
  );
  
  const messages: ChatMessage[] = [
    { id: Math.random().toString(36).substring(7), role: "user", content: task }
  ];

  let iterations = 0;
  const maxLimit = customMaxIterations || definition.maxIterations;

  while (iterations < maxLimit) {
    if (signal?.aborted) throw new Error("Sub-agent aborted");
    iterations++;

    onProgress?.(`${definition.name}: Iteration ${iterations}/${maxLimit} - requesting model response`, messages);

    let responseMsg: any;
    const sanitizedMessages = sanitizeMessagesForLLM(messages);

    if (settings.apiProvider === "gemini") {
      const data = await submitGeminiRequest(
        settings.geminiApiKey || "",
        definition.model || settings.geminiModel || "gemini-2.5-flash",
        definition.systemPrompt,
        sanitizedMessages,
        signal!
      );
      responseMsg = data.message;
    } else {
      // Ollama flow with filtered tools
      const payloadMessages = [
        { role: "system", content: definition.systemPrompt },
        ...sanitizedMessages.flatMap<any>((m) => {
          if (m.role === "tool") {
            return m.toolInvocations?.map((inv) => ({
              role: "tool", content: inv.result, name: inv.name
            })) || [];
          }
          if (m.role === "assistant" && m.toolInvocations?.length) {
            return [{
              role: "assistant",
              content: m.content || "",
              tool_calls: m.toolInvocations.map((inv) => ({
                type: "function",
                function: { name: inv.name, arguments: inv.args }
              }))
            }];
          }
          return [{ role: m.role, content: m.content || "" }];
        })
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
          options: {
            num_predict: 4096,
            temperature: definition.temperature ?? 0.7
          }
        }),
        signal
      });

      if (!res.ok) throw new Error(`Sub-agent API Error: ${res.status}`);
      const data = await res.json();
      responseMsg = data.message;
    }

    // Process tool calls
    if (responseMsg.tool_calls?.length > 0) {
      const invocations = responseMsg.tool_calls.map((tc: any) => ({
        id: Math.random().toString(36).substring(7),
        name: tc.function.name,
        args: tc.function.arguments,
        status: "running" as const
      }));

      const asstMsg: ChatMessage = {
        id: Math.random().toString(36),
        role: "assistant",
        content: responseMsg.content || "",
        toolInvocations: invocations,
        geminiParts: responseMsg.geminiParts
      };
      messages.push(asstMsg);
      onProgress?.(`${definition.name}: selected ${invocations.length} tool call${invocations.length === 1 ? "" : "s"}`, messages);

      // Execute tools
      for (const inv of invocations) {
        if (!definition.allowedTools.includes(inv.name)) {
          inv.result = JSON.stringify({ error: `Tool "${inv.name}" is not allowed for ${definition.name}` });
          inv.status = "error";
          onProgress?.(`${definition.name}: blocked disallowed tool ${inv.name}`, messages);
          continue;
        }
        try {
          onProgress?.(`${definition.name}: using ${inv.name}`, messages);
          const result = await executeToolCallFn(
            inv.name,
            inv.args,
            workspaceId,
            settings,
            (chunk: string) => {
              inv.result = typeof chunk === "string" ? chunk : JSON.stringify(chunk);
              onProgress?.(`${definition.name}: streaming ${inv.name}`, messages);
            },
            signal
          );
          inv.result = typeof result === "string" ? result : JSON.stringify(result);
          inv.status = "success";
          onProgress?.(`${definition.name}: completed ${inv.name}`, messages);
        } catch (err: any) {
          inv.result = JSON.stringify({ error: err.message });
          inv.status = "error";
          onProgress?.(`${definition.name}: ${inv.name} failed`, messages);
        }
      }

      messages.push({
        id: Math.random().toString(36),
        role: "tool",
        content: "",
        toolInvocations: invocations
      });
      onProgress?.(`${definition.name}: tool results recorded`, messages);
    } else {
      // Final text response — sub-agent is done
      messages.push({
        id: Math.random().toString(36),
        role: "assistant",
        content: responseMsg.content,
        geminiParts: responseMsg.geminiParts
      });
      onProgress?.(`${definition.name}: final response ready`, messages);
      
      return { result: responseMsg.content, messages };
    }
  }

  return { 
    result: `Sub-agent ${definition.name} reached maximum iterations (${maxLimit})`,
    messages 
  };
}
