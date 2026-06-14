import { ChatMessage, Settings, ToolInvocation } from "./types";

export const TOOLS_SCHEMA = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the entire contents of a file",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file_lines",
      description: "Read specific line ranges of a file. Use this for reading sections of large files.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          startLine: { type: "number", description: "The 1-based start line number (inclusive)" },
          endLine: { type: "number", description: "The 1-based end line number (inclusive)" }
        },
        required: ["path", "startLine", "endLine"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write string content to a file",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_in_file",
      description:
        "Replace a specific string in a file with new content. Useful for targeted edits.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          search: { type: "string" },
          replace: { type: "string" },
        },
        required: ["path", "search", "replace"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_content",
      description: "Search using grep for a specific pattern in the workspace",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          directory: { type: "string" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Run a shell command in the workspace. Useful for ls, npm install, etc",
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web using DuckDuckGo to find information",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_browse",
      description:
        "Browse, scrape, or read the textual content of any specific webpage or URL. Extremely useful for reading documentation links.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description:
              "The absolute URL to browse or read (e.g. https://example.com/docs)",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory_files",
      description:
        "Recursively list all files and subdirectories starting from a target directory path to understand workspace structure.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              'The target directory path. Defaults to "." for workspace root.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sequential_thinking",
      description:
        "Used for step-by-step thinking or planning before acting. Just pass your thought.",
      parameters: {
        type: "object",
        properties: { thought: { type: "string" } },
        required: ["thought"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_commit_push",
      description: "Commit all changes and push to GitHub",
      parameters: {
        type: "object",
        properties: { message: { type: "string" } },
        required: ["message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clone_git_repository",
      description:
        "Clone a GitHub repository into the active workspace, with an optional GitHub access token.",
      parameters: {
        type: "object",
        properties: {
          repoUrl: {
            type: "string",
            description:
              "The HTTPS URL of the GitHub repository (e.g., https://github.com/user/repo).",
          },
          token: {
            type: "string",
            description:
              "Optional GitHub personal access token (e.g. ghp_...) for private repositories.",
          },
        },
        required: ["repoUrl"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_navigate",
      description:
        "Navigate the local Sandbox Browser Preview to a specific address or local port (e.g. \"http://localhost:5173\" or just \"http://localhost:3000\"). Use this whenever you start a web server/application to view it.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description:
              "The local URL or port to load, e.g. \"http://localhost:5173/\" or \"3000\".",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_click",
      description:
        "Simulate a real mouse click on a DOM element inside the active Sandbox Browser page using its CSS selector.",
      parameters: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description:
              "The CSS selector of the click target element, e.g. \"button#login-btn\".",
          },
        },
        required: ["selector"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_type",
      description:
        "Simulate keyboard typing into a DOM input/textarea element inside the active Sandbox Browser page using its CSS selector.",
      parameters: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description: "The CSS selector of the input field, e.g. \"input[type=email]\".",
          },
          text: {
            type: "string",
            description: "The plain text to type into the input field.",
          },
        },
        required: ["selector", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_get_state",
      description:
        "Retrieve the current active URL and captured snapshot HTML of the local Sandbox Browser Preview. Use this to verify rendering output and diagnose UI pages.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

export async function fetchOllamaModels(url: string) {
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/api/tags`);
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    return { models: data.models.map((m: any) => m.name), error: null };
  } catch (error: any) {
    return {
      models: [],
      error:
        "Failed to fetch (check CORS or mixed-content if running on HTTPS)",
    };
  }
}

export async function executeToolCall(
  name: string,
  args: any,
  workspaceId: string,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
) {
  const proxyBase = ""; // Running on same domain since Vite proxies/serves in dev/prod

  const req = async (path: string, body: any) => {
    const res = await fetch(proxyBase + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, workspaceId }),
      signal,
    });
    return res.json();
  };

  if (name === "run_command") {
    const res = await fetch(proxyBase + "/api/cmd/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...args, workspaceId }),
      signal,
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) return { output: "No output" };
    const decoder = new TextDecoder();
    let result = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      result += chunk;
      if (onChunk) onChunk(result);
    }
    return { output: result || "Command executed successfully." };
  }

  switch (name) {
    case "read_file":
      return await req("/api/fs/read", args);
    case "read_file_lines":
      return await req("/api/fs/read-lines", args);
    case "write_file":
      return await req("/api/fs/write", args);
    case "replace_in_file":
      return await req("/api/fs/replace", args);
    case "search_content":
      return await req("/api/fs/search", args);
    case "web_search":
      return await req("/api/web/search", args);
    case "web_browse":
      return await req("/api/web/browse", args);
    case "list_directory_files":
      return await req("/api/fs/list", args);
    case "git_commit_push":
      return await req("/api/git/commit", args);
    case "clone_git_repository":
      return await req("/api/git/clone", args);
    case "browser_navigate":
      return await req("/api/browser/action", { type: "navigate", url: args.url });
    case "browser_click":
      return await req("/api/browser/action", { type: "click", selector: args.selector });
    case "browser_type":
      return await req("/api/browser/action", { type: "type", selector: args.selector, text: args.text });
    case "browser_get_state":
      return await req("/api/browser/action", { type: "get-html" });
    case "sequential_thinking":
      return { success: true, acknowledged_thought: args.thought };
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function initializeRepo(
  repoUrl: string,
  token: string,
  workspaceId: string,
) {
  const res = await fetch("/api/git/clone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl, token, workspaceId }),
  });
  return res.json();
}
