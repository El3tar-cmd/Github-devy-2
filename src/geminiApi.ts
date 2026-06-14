import { ChatMessage, ToolInvocation } from './types';
import { TOOLS_SCHEMA, executeToolCall } from './ollama';

// Convert OpenAI/Ollama tool schema to Gemini tool schema
const GEMINI_TOOLS = [{
  functionDeclarations: TOOLS_SCHEMA.map(t => {
    // Gemini expects types in uppercase string
    const mapType = (type: string) => type.toUpperCase();
    
    const properties: Record<string, any> = {};
    if (t.function.parameters?.properties) {
      for (const [key, val] of Object.entries<any>(t.function.parameters.properties)) {
        properties[key] = {
          type: mapType(val.type),
          description: val.description || '',
        };
      }
    }

    return {
      name: t.function.name,
      description: t.function.description,
      parameters: {
        type: 'OBJECT',
        properties,
        required: t.function.parameters?.required || []
      }
    };
  })
}];

export async function submitGeminiRequest(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  signal: AbortSignal
) {
  // Format messages
  const contents = messages.flatMap<any>(m => {
    if (m.role === 'tool') {
      return [{
        role: "function",
        parts: m.toolInvocations?.map(inv => ({
          functionResponse: {
            name: inv.name,
            response: { result: inv.result }
          }
        })) || []
      }];
    }

    if (m.role === 'assistant') {
      if (m.geminiParts && m.geminiParts.length > 0) {
        return [{
          role: "model",
          parts: m.geminiParts
        }];
      }

      if (m.toolInvocations && m.toolInvocations.length > 0) {
        return [{
          role: "model",
          parts: [
            ...(m.content ? [{ text: m.content }] : []),
            ...m.toolInvocations.map(inv => ({
              functionCall: {
                name: inv.name,
                args: inv.args
              }
            }))
          ]
        }];
      }
    }

    return [{
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }]
    }];
  });

  const payload = {
    systemInstruction: {
      role: "user",
      parts: [{ text: systemPrompt }]
    },
    contents,
    tools: [
      { googleSearch: {} },
      ...GEMINI_TOOLS
    ],
    toolConfig: {
      includeServerSideToolInvocations: true
    }
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
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Gemini API proxy error ${res.status}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  
  if (!candidate) {
    throw new Error('No candidate returned from Gemini');
  }

  const parts = candidate.content?.parts || [];
  let text = '';
  const toolCalls: any[] = [];

  for (const part of parts) {
    if (part.text) {
      text += part.text;
    }
    if (part.functionCall) {
      toolCalls.push({
        function: {
          name: part.functionCall.name,
          arguments: part.functionCall.args
        }
      });
    }
  }

  // Handle Google Search Grounding metadata citations if present
  const metadata = candidate?.groundingMetadata;
  if (metadata?.groundingChunks && metadata.groundingChunks.length > 0) {
    const sources: string[] = [];
    for (const chunk of metadata.groundingChunks) {
      if (chunk.web?.uri) {
        const title = chunk.web.title || 'Source';
        sources.push(`- [${title}](${chunk.web.uri})`);
      }
    }
    if (sources.length > 0) {
      text += `\n\n---\n### 🌐 مصادر البحث (Google Search Sources):\n` + sources.join('\n');
    }
  }

  // To maintain compatibility with the existing useAgent, map it to an Ollama-like response
  return {
    message: {
      role: 'assistant',
      content: text,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      geminiParts: parts
    }
  };
}
