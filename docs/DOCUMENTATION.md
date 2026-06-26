# Github-devy Documentation

Welcome to the comprehensive documentation for Github-devy, an advanced AI-powered cloud development environment.

## Table of Contents

1. [Introduction](#introduction)
2. [Core Architecture](#core-architecture)
3. [Component Documentation](#component-documentation)
4. [API Reference](#api-reference)
5. [Configuration Guide](#configuration-guide)
6. [Development Guide](#development-guide)
7. [Deployment Guide](#deployment-guide)
8. [Troubleshooting](#troubleshooting)

---

## Introduction

Github-devy is a sophisticated cloud-based Integrated Development Environment (IDE) that combines traditional development tools with cutting-edge AI capabilities. This documentation provides detailed information about every aspect of the system.

### Key Concepts

- **Workspaces**: Isolated development environments where projects live and operate
- **Agents**: AI-powered assistants that can autonomously perform development tasks
- **Sandbox**: Security boundaries that prevent operations from affecting the host system
- **Dual-Fallback**: Redundancy mechanisms ensuring continuous operation under various network conditions

---

## Core Architecture

### System Overview

Github-devy follows a modern microservices-inspired architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer (Vite)                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │   React UI  │ │   Monaco    │ │    xterm.js Terminal    │ │
│  │  Components │ │   Editor    │ │      WebSocket Engine   │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer (Express)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │  AI API  │ │  Git API │ │ File API │ │  Command API   │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Browser  │ │ Database │ │ Package  │ │   Workspace    │  │
│  │  Proxy   │ │  Manager │ │ Manager  │ │   Manager      │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                  Data Layer (Sandbox FS)                     │
│              .agent_workspace/[workspace-id]/                │
│         Projects, Dependencies, Temporary Files              │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Frontend
- **React 19**: Modern UI framework with concurrent features
- **TypeScript 5.8**: Type-safe development
- **Vite 6**: Fast build tool and dev server
- **Tailwind CSS 4**: Utility-first CSS framework
- **Framer Motion**: Smooth animations and transitions
- **Monaco Editor**: VS Code's editor component
- **xterm.js**: Terminal emulation

#### Backend
- **Node.js**: JavaScript runtime
- **Express**: Web framework
- **WebSocket**: Real-time communication
- **esbuild**: Fast TypeScript compilation

#### AI Integration
- **Google Gemini API**: Cloud-based AI models
- **Ollama**: Local LLM support
- **Custom Agent System**: Autonomous task execution

---

## Component Documentation

### Layout Components

#### SidebarLayout
Manages the collapsible sidebar navigation and provides context for layout management.

**Props:**
- `sidebarOpen: boolean` - Controls sidebar visibility
- `setSidebarOpen: (open: boolean) => void` - Sidebar state setter
- `setIdeTab: (tab: IdeTab) => void` - IDE tab switcher

**Features:**
- Responsive design with mobile support
- Smooth collapse/expand animations
- Keyboard navigation support

#### ChatLayout
Handles the chat interface layout for AI interactions.

**Features:**
- Message rendering with markdown support
- Code syntax highlighting
- Tool invocation display
- Streaming response handling

#### IdeLayout
Main development interface with multiple tabs and panels.

**Tabs:**
- `editor`: Monaco code editor
- `browser`: Live preview
- `terminal`: Command-line interface
- `search`: Global search
- `git`: Version control
- `db`: Database management
- `debugger`: Debugging tools
- `package`: Package manager
- `builder`: AI UI builder
- `planner`: Project planning
- `trajectory`: Agent trajectory visualizer showing step-by-step reasoning
- `ast`: Code AST dependency network graph
- `sandbox`: Third-party API mocking sandbox and webhook simulator

### Terminal Components

#### TerminalUI
Main terminal component with dual-fallback support.

**Features:**
- WebSocket primary connection
- HTTP fallback tunnel
- Multi-tab support
- Process management
- Command history
- Copy/paste functionality

**Usage:**
```tsx
<TerminalUI 
  workspaceId={workspaceId}
  onProcessChange={handleProcessChange}
/>
```

#### ProcessManager
Monitors and manages running terminal processes.

**Features:**
- Real-time process list
- Process termination
- Resource monitoring
- Log streaming

#### TerminalToolbar
Quick access toolbar for common terminal operations.

**Actions:**
- New terminal tab
- Clear terminal
- Copy selection
- Paste from clipboard
- Toggle fullscreen

### AI Components

#### ChatMessageUI
Displays chat messages with support for various content types.

**Features:**
- Markdown rendering
- Code block highlighting
- Tool invocation display
- Streaming text support
- Message actions (copy, regenerate)

#### AIBuilder
AI-powered UI component generator.

**Features:**
- Natural language to UI generation
- Preset templates
- Quick styling actions
- Multi-page projects
- Live preview
- Code export

**Presets:**
- Glass Login
- SaaS Pricing
- Portfolio
- Dashboard

**Quick Actions:**
- Dark Theme conversion
- Glassmorphism effects
- Responsive navigation
- Contact forms
- Review grids
- FAQ accordions

#### PlannerPanel
AI-driven project planning and task management.

**Features:**
- Task decomposition
- Timeline generation
- Progress tracking
- Resource allocation
- Milestone planning

### File System Components

#### FileTree
Hierarchical file system explorer.

**Features:**
- Dynamic tree rendering
- Drag-and-drop support
- Context menu operations
- File search
- Symbolic link handling
- Git status integration

**Operations:**
- Create files/folders
- Rename items
- Delete items
- Copy/move files
- Import/export projects

#### FileModals
Modal dialogs for file operations.

**Modals:**
- Create file/folder
- Rename item
- Delete confirmation
- Import options
- Export settings

#### SearchUI
Global search functionality across workspace files.

**Features:**
- Text search with regex
- File filtering
- Content preview
- Search history
- Replace functionality

### Development Tools

#### GitUI
Complete Git integration interface.

**Features:**
- Repository initialization
- Branch management
- Commit operations
- Push/pull synchronization
- Merge conflict resolution
- Commit history visualization

**Operations:**
```typescript
// Status check
POST /api/git/status
{ workspaceId: string }

// Commit changes
POST /api/git/commit
{ workspaceId: string, message: string, files: string[] }

// Push to remote
POST /api/git/push
{ workspaceId: string, force: boolean }
```

#### PackageManager
NPM package management interface.

**Features:**
- Package installation/uninstallation
- Registry search
- Dependency tree view
- Script execution
- Vulnerability scanning

**API Endpoints:**
```typescript
// List packages
POST /api/package/list
{ workspaceId: string }

// Install package
POST /api/package/install
{ workspaceId: string, packages: string[], dev: boolean }

// Search registry
POST /api/package/search
{ query: string }
```

#### DatabaseManager
SQLite database management interface.

**Features:**
- Database creation/management
- Table operations
- Query editor
- Data browsing
- Import/export functionality

**Supported Operations:**
- SELECT queries
- INSERT/UPDATE/DELETE
- CREATE/DROP tables
- Schema modifications

#### DebuggerPanel
Code debugging interface.

**Features:**
- Breakpoint management
- Variable inspection
- Call stack navigation
- Step execution controls
- Performance profiling

#### PortManager
Development server port management.

**Features:**
- Active port detection
- Service monitoring
- Port allocation
- Conflict resolution
- Service status tracking

---

## API Reference

### REST API Endpoints

#### Workspace Management

```typescript
// List all workspaces
GET /api/workspaces

// Create new workspace
POST /api/workspace/create
{
  name: string;
  template?: string;
}

// Switch workspace
POST /api/workspace/switch
{
  workspaceId: string;
}

// Delete workspace
DELETE /api/workspace/:id
```

#### File System Operations

```typescript
// List directory contents
POST /api/fs/list
{
  workspaceId: string;
  path: string;
}

// Read file content
POST /api/fs/read
{
  workspaceId: string;
  path: string;
}

// Write file content
POST /api/fs/write
{
  workspaceId: string;
  path: string;
  content: string;
}

// Delete file/directory
POST /api/fs/delete
{
  workspaceId: string;
  path: string;
}

// Search files
POST /api/fs/search
{
  workspaceId: string;
  query: string;
  path?: string;
}
```

#### Command Execution

```typescript
// Execute command
POST /api/cmd/exec
{
  workspaceId: string;
  command: string;
  sessionId?: string;
}

// Get command output
GET /api/cmd/output/:sessionId

// Kill process
POST /api/cmd/kill
{
  sessionId: string;
}
```

#### Git Operations

```typescript
// Get repository status
POST /api/git/status
{
  workspaceId: string;
}

// Initialize repository
POST /api/git/init
{
  workspaceId: string;
}

// Clone repository
POST /api/git/clone
{
  workspaceId: string;
  url: string;
}

// Commit changes
POST /api/git/commit
{
  workspaceId: string;
  message: string;
  files?: string[];
}

// Push changes
POST /api/git/push
{
  workspaceId: string;
  force?: boolean;
}

// Pull changes
POST /api/git/pull
{
  workspaceId: string;
}
```

#### AI Integration

```typescript
// Generate AI response (Gemini)
POST /api/gemini/chat
{
  messages: ChatMessage[];
  model: string;
  tools?: Tool[];
}

// Generate AI response (Ollama)
POST /api/ollama/chat
{
  model: string;
  messages: ChatMessage[];
  tools?: Tool[];
}

// Stream AI response
POST /api/gemini/stream
{
  messages: ChatMessage[];
  model: string;
}
```

#### Database Operations

```typescript
// List databases
POST /api/db/list
{
  workspaceId: string;
}

// Execute query
POST /api/db/query
{
  workspaceId: string;
  dbPath: string;
  query: string;
}

// Get tables
POST /api/db/tables
{
  workspaceId: string;
  dbPath: string;
}
```

### WebSocket API

#### Terminal Connection

```javascript
// Connect to terminal WebSocket
const ws = new WebSocket(`ws://localhost:9876/terminal?workspaceId=${workspaceId}`);

// Send command
ws.send(JSON.stringify({
  type: 'command',
  command: 'npm run dev',
  sessionId: 'session-123'
}));

// Receive output
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'output') {
    console.log(data.output);
  }
};

// Resize terminal
ws.send(JSON.stringify({
  type: 'resize',
  cols: 80,
  rows: 24
}));
```

#### Event Types

- `output`: Terminal output data
- `error`: Error messages
- `exit`: Process exit event
- `status`: Connection status updates

---

## Configuration Guide

### Environment Variables

Create a `.env` file in the root directory:

```env
# AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
OLLAMA_URL=http://localhost:11434

# Server Configuration
PORT=9876
NODE_ENV=development

# GitHub Integration
GITHUB_TOKEN=your_github_token_here

# Workspace Configuration
WORKSPACE_ROOT=.agent_workspace
MAX_WORKSPACE_SIZE=1073741824
```

### Settings Structure

The application settings are managed through the Settings interface:

```typescript
interface Settings {
  // AI Provider Selection
  apiProvider: "ollama" | "gemini" | "lmstudio";
  
  // Ollama Configuration
  ollamaUrl: string;
  ollamaModel: string;
  
  // Gemini Configuration
  geminiApiKey: string;
  geminiModel: string;

  // LM Studio Configuration
  lmStudioUrl: string;
  lmStudioModel: string;
  
  // GitHub Integration
  repoUrl: string;
  githubToken: string;
  
  // AI Behavior
  systemPrompt: string;
  enableAutocomplete: boolean;
  planModeActive: boolean;
  maxIterations: number;
}
```

### Workspace Configuration

Each workspace can have its own configuration:

```json
{
  "name": "my-project",
  "id": "workspace-123",
  "settings": {
    "nodeVersion": "18",
    "port": 3000,
    "autoStart": true,
    "gitIntegration": true
  },
  "created": "2024-01-01T00:00:00Z",
  "lastModified": "2024-01-02T12:00:00Z"
}
```

---

## Development Guide

### Setting Up Development Environment

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/github-devy.git
cd github-devy
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start development server:**
```bash
npm run dev
```

### Project Structure

```
Github-devy/
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React contexts
│   ├── agent/          # AI agent logic
│   ├── hooks/          # Custom hooks
│   └── utils/          # Utility functions
├── server/             # Backend code
│   ├── routes/         # API routes
│   ├── utils/          # Server utilities
│   └── websocket/      # WebSocket handlers
├── public/             # Static assets
└── tools/              # Build tools
```

### Coding Standards

- **TypeScript**: Strict mode enabled
- **React**: Functional components with hooks
- **Styling**: Tailwind CSS utility classes
- **Formatting**: Prettier configuration
- **Linting**: ESLint with TypeScript rules

### Testing

Run the test suite:

```bash
npm test
```

Run platform compatibility tests:

```bash
npm run test:platform
```

### Building for Production

1. **Build frontend:**
```bash
npm run build
```

2. **Start production server:**
```bash
npm start
```

The production build:
- Creates optimized bundles
- Minifies JavaScript and CSS
- Generates source maps
- Compiles server to CommonJS

---

## Deployment Guide

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 9876

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t github-devy .
docker run -p 9876:9876 -v $(pwd)/.agent_workspace:/app/.agent_workspace github-devy
```

### Cloud Deployment

#### AWS Elastic Beanstalk

1. Create application
2. Upload deployment package
3. Configure environment variables
4. Deploy and monitor

#### Google Cloud Run

```bash
gcloud run deploy github-devy \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### Vercel

```bash
vercel deploy
```

### Performance Optimization

1. **Enable gzip compression**
2. **Configure CDN for static assets**
3. **Enable HTTP/2**
4. **Optimize database queries**
5. **Implement caching strategies**

---

## Troubleshooting

### Common Issues

#### Terminal Connection Issues

**Problem**: Terminal not connecting or showing errors

**Solutions**:
1. Check WebSocket port accessibility
2. Verify firewall settings
3. Try HTTP fallback mode
4. Check workspace permissions

#### AI Integration Problems

**Problem**: AI responses failing or timing out

**Solutions**:
1. Verify API keys are correct
2. Check network connectivity
3. Ensure Ollama is running (for local models)
4. Reduce context window size

#### File System Errors

**Problem**: Cannot read/write files

**Solutions**:
1. Check workspace permissions
2. Verify disk space availability
3. Check file system integrity
4. Ensure paths are correct

#### Build Failures

**Problem**: Build process fails

**Solutions**:
1. Clear node_modules and reinstall
2. Update dependencies
3. Check TypeScript errors
4. Verify environment variables

### Debug Mode

Enable debug logging:

```env
DEBUG=github-devy:*
NODE_ENV=development
```

### Log Files

Check application logs:

```bash
# Terminal logs
tail -f .agent_workspace/[workspace-id]/terminal.log

# Error logs
tail -f logs/error.log

# Access logs
tail -f logs/access.log
```

### Getting Help

- Check documentation: `/docs`
- Report issues: GitHub Issues
- Community support: Discord/Slack
- Email support: support@github-devy.com

---

## Advanced Topics

### Custom Tool Development

Create custom AI tools:

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any) => Promise<any>;
}

const customTool: Tool = {
  name: 'custom_operation',
  description: 'Performs custom operation',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string' }
    }
  },
  execute: async (params) => {
    // Custom logic here
    return { result: 'success' };
  }
};
```

### Plugin Development

Extend functionality with plugins:

```typescript
interface Plugin {
  name: string;
  version: string;
  init: (app: Express) => void;
  routes: Router[];
}

const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  init: (app) => {
    // Initialize plugin
  },
  routes: [
    // Custom routes
  ]
};
```

### Security Best Practices

1. **Workspace Isolation**: Ensure proper sandboxing
2. **API Key Protection**: Never expose keys in client code
3. **Input Validation**: Validate all user inputs
4. **Rate Limiting**: Implement API rate limits
5. **HTTPS Only**: Use HTTPS in production
6. **Regular Updates**: Keep dependencies updated

## Advanced AI Features

Github-devy incorporates a state-of-the-art multi-agent orchestration architecture and a symbol-aware Retrieval-Augmented Generation (RAG) system.

### Codebase RAG & AST Indexing

Instead of dumping the entire directory structure into the LLM's context, the platform utilizes hybrid dense-sparse retrieval to inject precise, symbol-level code context on demand:
1. **Parser Layer:** Processes source code files dynamically. JS/TS files are parsed into symbol nodes (functions, classes, interfaces) using the native TypeScript Compiler AST APIs. Python files are parsed using structural indentation block extraction. Other document types are chunked by line blocks.
2. **Indexing Database:** Cached locally under `.github-devy/rag_index.json`. The indexing process:
   - Computes TF-IDF keyword weights across symbols and paths.
   - Generates 768-dimension semantic embeddings using Google Gemini's `text-embedding-004` model when `GEMINI_API_KEY` is provided.
3. **Retrieval Scorer:** Merges keyword matches and semantic cosine similarities:
   $$\text{Score} = (0.4 \times \text{Keyword}) + (0.6 \times \text{Vector})$$
4. **Self-Healing Fallback:** Calling the search endpoint on an unindexed workspace automatically triggers indexing in the background on the fly.

---

### Asynchronous Multi-Agent Background Orchestration

For complex programming pipelines (such as planning, writing code, reviewing, and debugging), the main agent can delegate tasks to specialist sub-agents. These sub-agents run either in the foreground (synchronous blocking) or concurrently in the background (asynchronous):
1. **Spawning Workers:** Start workers via the `invoke_subagent` and `invoke_parallel_subagents` tools. Set `background: true` to run asynchronously in the background.
2. **Guards & Timeouts:** Configure `maxIterations` (caps total ReAct cycles) and `timeoutSeconds` (hard run time limits aborted via WebSocket-based abort controller signals) to control token budget and avoid infinite loops.
3. **Tracking Progress:** Query active sub-agent results and states via the `get_subagent_status` tool or list session history via `list_subagents`.

---

### Context Window & Token economy Guardrails

The platform enforces strict safety rules to conserve token budgets and prevent model freezes:
- **Image Data Detachment:** Heavy base64 data URLs returned by `browser_screenshot` are stripped from messages right before sending history payloads to the LLM. This prevents token explosion while preserving full image rendering in the IDE chat window.
- **File Truncation:** Reading large files is limited to 32,000 characters to prevent context window exhaustion. Agents are instructed to use `read_file_lines` for targeted reads.
- **Output Capping:** Outputs are hard-bounded at 4,096 tokens per request.

---

## Contributing

We welcome contributions! Please see our contributing guidelines for details.

### Development Workflow

1. Fork the repository
2. Create feature branch
3. Make your changes
4. Add tests
5. Submit pull request

### Code Review Process

1. Automated checks pass
2. Manual review by maintainers
3. Feedback integration
4. Approval and merge

---

## License

This project is licensed under the MIT License - see LICENSE file for details.

---

## Support

For additional help and resources:
- Documentation: `/docs`
- API Reference: See API Reference section
- Examples: `/examples`
- Community: Join our Discord server

---

*Last updated: June 2026*