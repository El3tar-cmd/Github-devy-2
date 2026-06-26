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
        "Replace a specific exact string in a file with new content. Use for targeted single-file edits. IMPORTANT: the 'search' string must match the file content character-for-character including all whitespace and indentation.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path to the file" },
          search: { type: "string", description: "The exact string to find in the file (must be unique within the file)" },
          replace: { type: "string", description: "The replacement string" },
        },
        required: ["path", "search", "replace"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "multi_file_edit",
      description:
        "Apply precise search-and-replace edits to multiple files in a single atomic operation. Use this instead of calling replace_in_file repeatedly when editing more than one file. Each edit targets one exact string in one file.",
      parameters: {
        type: "object",
        properties: {
          edits: {
            type: "array",
            description: "List of file edits to apply. Each edit is applied sequentially within each file.",
            items: {
              type: "object",
              properties: {
                path: { type: "string", description: "Relative file path" },
                search: { type: "string", description: "Exact string to find (must match verbatim including whitespace)" },
                replace: { type: "string", description: "Replacement string" },
              },
              required: ["path", "search", "replace"],
            },
          },
        },
        required: ["edits"],
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
        "Run a shell command in the workspace. Short commands return normally; commands that keep running return control with a background PID so you can continue working and inspect/stop them later.",
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
  {
    type: "function",
    function: {
      name: "git_status",
      description: "Get status of the Git repository in the workspace (modified, untracked, added, deleted files)",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "git_diff",
      description: "Get diff of a specific file in the local Git repository",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "The relative path of the file to see git diff for" }
        },
        required: ["filePath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "git_pull",
      description: "Pull latest changes from remote Git repository",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "git_push",
      description: "Push committed local branch changes to remote Git repository",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "git_init",
      description: "Initialize a new local Git repository in workspace root",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "git_history",
      description: "List recent Git commits with hash, author, date, and subject",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Maximum commits to return, default 30, max 200" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "git_branches",
      description: "List local and remote Git branches and identify the current branch",
      parameters: {
        type: "object",
        properties: {
          includeRemote: { type: "boolean", description: "Include remote branches. Defaults to true." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "git_checkout",
      description: "Switch Git branches or create a new branch from an optional start point",
      parameters: {
        type: "object",
        properties: {
          branch: { type: "string", description: "Branch name to switch to or create" },
          create: { type: "boolean", description: "Create the branch before switching" },
          startPoint: { type: "string", description: "Optional ref to create the branch from" }
        },
        required: ["branch"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "git_fetch",
      description: "Fetch updates from a remote repository",
      parameters: {
        type: "object",
        properties: {
          remote: { type: "string", description: "Remote name, default origin" },
          prune: { type: "boolean", description: "Prune deleted remote refs, default true" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "git_merge",
      description: "Merge a Git ref into the current branch",
      parameters: {
        type: "object",
        properties: {
          ref: { type: "string", description: "Branch, tag, or commit to merge" },
          noFf: { type: "boolean", description: "Use --no-ff" }
        },
        required: ["ref"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "git_remotes",
      description: "List configured Git remotes",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "git_remote",
      description: "Add, update, or remove a Git remote",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add", "set-url", "remove"], description: "Remote operation" },
          name: { type: "string", description: "Remote name, default origin" },
          url: { type: "string", description: "Remote URL, required except for remove" }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "git_stash",
      description: "List, create, apply, pop, or drop Git stashes",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "push", "pop", "apply", "drop"], description: "Stash operation" },
          message: { type: "string", description: "Message when pushing a stash" },
          stashRef: { type: "string", description: "Optional stash reference such as stash@{0}" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "git_tags",
      description: "List, create, or delete Git tags",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create", "delete"], description: "Tag operation" },
          name: { type: "string", description: "Tag name for create/delete" },
          message: { type: "string", description: "Annotated tag message" },
          ref: { type: "string", description: "Optional commit/ref to tag" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "github_actions_runs",
      description: "List GitHub Actions workflow runs for the current GitHub repo or a provided owner/repo",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "GitHub owner. Optional if origin remote is GitHub." },
          repo: { type: "string", description: "GitHub repository. Optional if origin remote is GitHub." },
          branch: { type: "string", description: "Optional branch filter" },
          workflowId: { type: "string", description: "Optional workflow file name or workflow id" },
          limit: { type: "number", description: "Maximum runs to return, default 20, max 100" },
          token: { type: "string", description: "Optional GitHub token for private repositories" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "github_actions_run",
      description: "Get details for one GitHub Actions workflow run",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo: { type: "string" },
          runId: { type: "number", description: "GitHub Actions run id" },
          token: { type: "string", description: "Optional GitHub token for private repositories" }
        },
        required: ["runId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "github_actions_jobs",
      description: "List jobs for a GitHub Actions workflow run",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo: { type: "string" },
          runId: { type: "number", description: "GitHub Actions run id" },
          token: { type: "string", description: "Optional GitHub token for private repositories" }
        },
        required: ["runId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "github_actions_logs",
      description: "Fetch logs for a GitHub Actions run or job. Use jobId for readable job logs; run logs may be a zip payload.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo: { type: "string" },
          runId: { type: "number", description: "Workflow run id" },
          jobId: { type: "number", description: "Workflow job id" },
          token: { type: "string", description: "Optional GitHub token for private repositories" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "github_actions_artifacts",
      description: "List artifacts produced by a GitHub Actions workflow run, such as APK zip artifacts",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo: { type: "string" },
          runId: { type: "number", description: "GitHub Actions run id" },
          token: { type: "string", description: "Optional GitHub token for private repositories" }
        },
        required: ["runId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "github_actions_download_artifact",
      description: "Download a GitHub Actions artifact zip into .github-devy/artifacts in the workspace",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo: { type: "string" },
          artifactId: { type: "number", description: "Artifact id from github_actions_artifacts" },
          fileName: { type: "string", description: "Optional zip file name to save as" },
          token: { type: "string", description: "Optional GitHub token for private repositories" }
        },
        required: ["artifactId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_packages",
      description: "Install, uninstall, or update npm packages in the workspace project",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["install", "uninstall", "update", "list"],
            description: "The package action to perform"
          },
          packageName: {
            type: "string",
            description: "Optional package name. Leave empty for general install/update of all dependencies in package.json."
          },
          isDev: {
            type: "boolean",
            description: "Set true if it should be installed as devDependency"
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_directory",
      description: "Create a directory in the workspace, including parent directories when needed",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative directory path to create" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "rename_path",
      description: "Rename or move a file or directory within the workspace",
      parameters: {
        type: "object",
        properties: {
          oldPath: { type: "string", description: "Current workspace-relative file or directory path" },
          newPath: { type: "string", description: "New workspace-relative file or directory path" }
        },
        required: ["oldPath", "newPath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_path",
      description: "Delete a file or directory from the workspace",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative file or directory path to delete" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "database_list",
      description: "Find SQLite database files in the workspace",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "database_tables",
      description: "List user tables in a SQLite database file",
      parameters: {
        type: "object",
        properties: {
          dbPath: { type: "string", description: "Workspace-relative SQLite database path" }
        },
        required: ["dbPath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "database_query",
      description: "Run a SQL query against a SQLite database file and return rows or write results",
      parameters: {
        type: "object",
        properties: {
          dbPath: { type: "string", description: "Workspace-relative SQLite database path" },
          query: { type: "string", description: "SQL query to execute" }
        },
        required: ["dbPath", "query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "debug_start",
      description: "Start a long-running debug command in the workspace and return a session id",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Command to run for debugging, such as a dev server or test watcher" }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "debug_logs",
      description: "Read logs and status for a debug session",
      parameters: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Debug session id returned by debug_start" }
        },
        required: ["sessionId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "debug_kill",
      description: "Kill a running debug session and its child process tree",
      parameters: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Debug session id to kill" }
        },
        required: ["sessionId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "debug_sessions",
      description: "List active and completed debug sessions",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "list_active_processes",
      description: "List active interactive terminal sessions and background command processes",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "kill_process",
      description: "Kill an active terminal session or background command process and its process tree",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["terminal", "background"], description: "Process type from list_active_processes" },
          id: { type: "string", description: "Terminal session id or background process pid from list_active_processes" }
        },
        required: ["type", "id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sandbox_logs",
      description: "Read logs captured by the local sandbox mock providers for Stripe, Twilio, Auth0, and webhooks",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "sandbox_clear_logs",
      description: "Clear logs captured by the local sandbox mock providers",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "sandbox_trigger_webhook",
      description: "Send a mock webhook event payload to an application endpoint",
      parameters: {
        type: "object",
        properties: {
          webhookUrl: { type: "string", description: "Absolute or local URL that should receive the webhook" },
          eventType: { type: "string", description: "Mock event type, such as payment_intent.succeeded" }
        },
        required: ["webhookUrl", "eventType"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ask_human",
      description: "Request human input only for true blockers: missing secrets/credentials, approval for destructive or irreversible actions, impossible-to-infer requirements, or mutually exclusive product decisions. Do not use for routine phase approval, planning checkpoints, status updates, or asking whether to continue.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "A concise blocker question. Include why the answer is required before work can continue." }
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_screenshot",
      description: "Capture a visual screenshot of the Sandbox Browser Preview viewport. The output is saved to a unique file under '.github-devy/screenshots/' in the workspace.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "invoke_subagent",
      description: "Spawn a specialized sub-agent to handle a focused task. Prefer this for medium or larger work, multi-file edits, debugging, testing, security review, code review, research, or any task that benefits from a second focused pass. Runs in the background by default and returns a task handle immediately so the main agent can continue working.",
      parameters: {
        type: "object",
        properties: {
          agentType: {
            type: "string",
            enum: ["researcher", "coder", "reviewer", "debugger", "planner"],
            description: "The type of sub-agent to spawn",
          },
          agentName: {
            type: "string",
            description: "Optional override. Normally omit this so the orchestrator derives a task-specific name automatically.",
          },
          task: {
            type: "string",
            description: "A clear, detailed task description for the sub-agent",
          },
          maxIterations: {
            type: "number",
            description: "Optional. Maximum ReAct iterations for the sub-agent (default is 10, range: 1-30).",
          },
          timeoutSeconds: {
            type: "number",
            description: "Optional. Maximum runtime in seconds before the sub-agent execution is aborted (e.g. 120).",
          },
          background: {
            type: "boolean",
            description: "Optional. Defaults to true. Set false only when you intentionally want to block until the sub-agent finishes.",
          }
        },
        required: ["agentType", "task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "invoke_parallel_subagents",
      description: "Spawn multiple sub-agents in parallel to work on separate aspects of a medium or complex task simultaneously. Prefer this when work can be split by file, concern, phase, or specialty instead of doing all analysis in the main agent.",
      parameters: {
        type: "object",
        properties: {
          agents: {
            type: "array",
            description: "Array of sub-agents to launch in parallel",
            items: {
              type: "object",
              properties: {
                agentType: {
                  type: "string",
                  enum: ["researcher", "coder", "reviewer", "debugger", "planner"],
                  description: "The type of sub-agent to spawn",
                },
                agentName: { type: "string", description: "Optional override. Normally omit so the orchestrator derives a task-specific name automatically." },
                task: { type: "string", description: "The task description for this sub-agent" },
                maxIterations: { type: "number", description: "Optional. Maximum ReAct iterations for this sub-agent." },
                timeoutSeconds: { type: "number", description: "Optional. Maximum runtime in seconds for this sub-agent." }
              },
              required: ["agentType", "task"],
            },
          },
          background: {
            type: "boolean",
            description: "Optional. Defaults to true. Set false only when you intentionally want to block until all sub-agents finish.",
          }
        },
        required: ["agents"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_codebase_rag",
      description: "Search the codebase using a hybrid TF-IDF symbol and semantic embedding retriever to find relevant code snippets, functions, classes, and types.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The semantic or keyword query describing the feature, function name, or symbol to search for"
          },
          limit: {
            type: "number",
            description: "The maximum number of matches to return (default is 10)"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "index_codebase_rag",
      description: "Rebuild the codebase RAG index manually. Call this after making large code updates to keep the search index accurate.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_subagent_status",
      description: "Check the current execution status and get final results of a managed sub-agent by id or name.",
      parameters: {
        type: "object",
        properties: {
          agentId: {
            type: "string",
            description: "The unique ID or exact name of the sub-agent to check"
          }
        },
        required: ["agentId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remove_subagent",
      description: "Remove a managed sub-agent from the orchestra and free its roster slot. Use force=true to cancel queued/running work before removing.",
      parameters: {
        type: "object",
        properties: {
          agentId: { type: "string", description: "Agent id returned by invoke_subagent, invoke_parallel_subagents, or list_subagents." },
          agentName: { type: "string", description: "Exact agent name if agentId is not provided." },
          force: { type: "boolean", description: "Cancel queued/running work before removing. Defaults to false." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_subagents",
      description: "List all managed sub-agents plus orchestra capacity, running count, and queued runs.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "start_background_command",
      description: "Start a long-running command as a tracked background task and return immediately. Use this for servers, watchers, builds, or tests that should continue while the main agent keeps working.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Workspace command to run in the background" },
          title: { type: "string", description: "Optional short human-readable task title" }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_agent_tasks",
      description: "List tracked background tasks, including background sub-agents and long-running commands.",
      parameters: {
        type: "object",
        properties: {
          includeCompleted: { type: "boolean", description: "Include completed/error/cancelled tasks. Defaults to true." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_agent_task",
      description: "Inspect one tracked background task and return its status, output, result, or linked logs.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "Task id returned by a background task tool" }
        },
        required: ["taskId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cancel_agent_task",
      description: "Cancel a tracked background task. Sub-agents are aborted; debug command tasks kill their process tree.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "Task id to cancel" }
        },
        required: ["taskId"]
      }
    }
  },
];
