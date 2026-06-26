import { ChatMessage, Settings } from "../types";

export async function summarizeHistory(
  messages: ChatMessage[],
  settings: Settings,
  signal?: AbortSignal
): Promise<string> {
  const summaryPrompt = `You are a professional context compressor. Summarize the following conversation history between a user and an AI coding agent.
Outline:
1. The main goal of the conversation.
2. Completed actions, code edits, and tools used.
3. Current state of the files and workspace.
4. Next steps, remaining tasks, or open questions.

Be highly professional, detailed but concise, and write the summary in the user's language (Arabic if the user spoke in Arabic, otherwise English). Do not include any meta-talk or introductory greetings. Just write the summary.`;

  const historyText = messages.map(m => {
    let text = `[${m.role.toUpperCase()}]: `;
    if (m.content) text += m.content;
    if (m.toolInvocations && m.toolInvocations.length > 0) {
      const toolDetails = m.toolInvocations.map(inv => {
        const resultSnippet = inv.result ? ` (result: ${inv.result.substring(0, 300)}${inv.result.length > 300 ? '...' : ''})` : '';
        return `${inv.name}(${JSON.stringify(inv.args)}) -> ${inv.status}${resultSnippet}`;
      }).join('\n');
      text += `\nTools called:\n${toolDetails}`;
    }
    return text;
  }).join('\n\n');

  const promptText = `Here is the conversation history between the user and the agent:\n\n${historyText}\n\nProvide a concise and structured summary now.`;

  if (settings.apiProvider === "gemini") {
    const apiKey = settings.geminiApiKey || "";
    const model = settings.geminiModel || "gemini-2.5-flash";
    const payload = {
      systemInstruction: {
        role: "user",
        parts: [{ text: "You are a context compression assistant. Your job is to summarize the chat history between the user and the agent." }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: `${summaryPrompt}\n\n${promptText}` }]
        }
      ]
    };

    const res = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        payload,
        clientApiKey: apiKey
      }),
      signal
    });

    if (!res.ok) {
      throw new Error(`Summary API Error: ${res.status}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || '';
    return text.trim();
  } else {
    const baseUrl = settings.ollamaUrl.replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.ollamaModel,
        messages: [
          { role: "system", content: "You are a context compression assistant. Your job is to summarize the chat history between the user and the agent." },
          { role: "user", content: `${summaryPrompt}\n\n${promptText}` }
        ],
        stream: false,
      }),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Summary Ollama Error: ${res.status}`);
    }

    const data = await res.json();
    return (data.message?.content || "").trim();
  }
}
