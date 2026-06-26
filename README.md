# 🚀 Github-devy

<div align="center">
  <p align="center">
    <strong>مستقبل بيئات التطوير السحابية المدعومة بالذكاء الاصطناعي</strong><br />
    <em>The Future of AI-Powered Cloud Development Workspaces</em>
  </p>
  
  <p align="center">
    <a href="#-features">Features</a> •
    <a href="#%D8%A7%D9%84%D9%85%D9%8A%D8%B2%D8%A7%D8%AA-%D8%A7%D9%84%D8%B1%D8%A6%D9%8A%D8%B3%D9%8A%D8%A9">الميزات</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#%D9%83%D9%8A%D9%81%D9%8A%D8%A9-%D8%A7%D9%84%D8%AA%D8%B4%D8%BA%D9%8A%D9%84">التشغيل</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-tech-stack">Tech Stack</a> •
    <a href="#-api-reference">API Reference</a> •
    <a href="#-contributing">Contributing</a>
  </p>
</div>

---

**Github-devy** هو منصة ويب متطورة وبيئة تطوير متكاملة (Cloud IDE) سحابية بالكامل، تدمج بين واجهة إدارة الملفات، والطرفية التفاعلية الهجينة (Terminal)، واستعراض المتصفح المباشر (Browser Preview)، مع محركات ذكاء اصطناعي متعددة (Gemini & Ollama) لمساعدتك في بناء وتطوير وإدارة المشاريع البرمجية في بيئة معزولة (Sandboxed-Workspaces) وبكفاءة غير مسبوقة.

**Github-devy** is an advanced, fully-featured cloud-based development environment and AI agent workspace. It consolidates a robust file explorer, an interactive dual-fallback terminal, sandboxed live preview browser proxy, and dual AI models (Google Gemini API & local Ollama) into a unified, high-performance developer console.

---

## 📋 Table of Contents / جدول المحتويات

- [Overview](#-github-devy)
- [Features](#-features--الميزات-الرئيسية)
- [Architecture](#-architecture--معمارية-المنصة)
- [Tech Stack](#-tech-stack--التقنيات-المستخدمة)
- [Getting Started](#-getting-started--كيفية-التشغيل-محلياً)
- [Configuration](#-configuration--الإعدادات)
- [Components Documentation](#-components-documentation--توثيق-المكونات)
- [API Reference](#-api-reference--مرجع-واجهة-البرمجة)
- [Advanced Features](#-advanced-features--الميزات-المتقدمة)
- [Troubleshooting](#-troubleshooting--حل-المشاكل)
- [Contributing](#-contributing--المساهمة)
- [License](#-license)

---

## ✨ Features / الميزات الرئيسية

### 📟 1. Hybrid Terminal with Dual Fallback | نظام طرفية تفاعلي هجين
- **WebSocket Mode:** Persistent, real-time command streaming powered by `xterm.js` for lightweight, continuous background processes (e.g., keeping dev servers alive).
- **HTTP/Fetch Tunnel:** Automatic failover to non-blocking HTTP polling and command execution if WebSockets are closed or blocked by firewalls.
- **Memory Buffer:** Intelligent, memory-safe server logs buffer up to 50,000 characters to prevent tab switches from clearing executing outputs.
- **ترمينال هجين ذكي:** يعرض المخرجات بشكل فوري عبر WebSocket مستمر، مع التحويل التلقائي لنمط HTTP Tunneling في حال انقطاع الاتصال أو القيود الأمنية لضمان عدم توقف العمل.

### 🌐 2. Browser Preview & SW Proxying | متصفح داخلي مدعوم بخادم وكيل
- **Service Worker Proxy (`proxy-sw.js`):** Intercepts dynamic asset requests on the fly, dynamically rewriting paths to resolve absolute resources correctly within sandboxed subpaths.
- **Instant Previews:** Test layouts, scripts, and endpoints inside a secure, fully reactive iframe with responsive viewport overrides.
- **خادم وكيل ذكي للـ assets:** يحل مشكلة استدعاء الملفات ذات المسارات المطلقة (Absolute paths) داخل الإطار (Iframe) بفضل Service Worker يعيد كتابة المسارات ديناميكياً.

### 🤖 3. Multi-Agent AI Core & Background Orchestration | نظام ذكاء اصطناعي متعدد الوكلاء التفاعلي
- **Asynchronous Orchestration:** Spawn specialized sub-agents (Researcher, Coder, Reviewer, Debugger, Planner) synchronously or asynchronously in the background (`background: true`).
- **Timeout & Iteration Safety:** Explicitly cap sub-agent loop depth (`maxIterations`) and execute runs with hard timeouts (`timeoutSeconds`) powered by WebSocket-based abort controller tunnels.
- **Codebase RAG & AST Indexing:** Dynamic workspace symbol-aware indexing (TypeScript Compiler API for JS/TS, pattern blocks for Python) matching semantic cosine vectors (Gemini `text-embedding-004`) and sparse keyword weights (TF-IDF).
- **Self-Healing Search:** RAG searches automatically construct project indexes in the background on the fly if missing, requiring zero setup.
- **Context Guardrails & Cost Dashboard:** Hard caps on token consumption, output bounds (`maxOutputTokens: 4096`), file read limits (~32KB characters truncation), and automatic base64 visual screenshot stripping to prevent context window bloat and loop freezes.
- **مساعد برمجي متطور تفاعلي:** نظام وكلاء ذكاء اصطناعي تفاعلي يدعم التشغيل المتوازي وفي الخلفية، والتحكم بالوقت الأقصى للتشغيل والخطوات لتفادي التكرار اللا نهائي.
- **محرك بحث كود متطور (RAG):** محرك مدمج يبني الفهرس اللغوي والرمزي للتعليمات البرمجية تلقائياً ويطابق العبارات عبر التضمينات الدلالية (Gemini Embeddings) والبحث المفتاحي (TF-IDF).

### 📁 4. Reactive Workspace and File System Explorer | مدير مساحات العمل والملفات
- **Dynamic File Tree:** Fully responsive tree component mapping real file directories on the server. Features search, creation, editing, and immediate syncing.
- **Workspace Sandboxing:** Create and switch between distinct developer workspaces with fully isolated dependency structures.
- **متصفح ملفات مرن:** تحكّم مرن في شجرة الملفات مع المزامنة اللحظية مع خادم لضمان دقة العمل مع إمكانية عزل المشاريع في مساحات عمل منفصلة.

### 📉 5. Agent Trajectory Visualizer & Replay Panel | لوحة تتبع مسار الوكيل وإعادة التشغيل
- **ReAct Loop Trace:** Beautiful vertical timeline rendering the thoughts, actions, and raw observations of the agent's ReAct cycle in real-time.
- **Cost & Token Analytics:** Tracks cumulative input/output token counts and calculated USD session costs dynamically.
- **لوحة تتبع تفصيلية:** تعرض خطوات تفكير الوكيل البرمجي (Thought)، والعمليات والأدوات التي استدعاها (Action)، والملاحظات والنتائج (Observation) في جدول زمني أنيق.

### 🧠 6. Self-Healing Terminal Autopilot | التوجيه الذاتي وإصلاح الأخطاء تلقائياً
- **Auto-Recovery Loop:** When a terminal run/test script fails with an exit code, the backend automatically triggers a recovery prompt to diagnose the crash logs, write code patches, and restart the process.
- **إصلاح الأخطاء الذاتي:** عند تعثر أو فشل تشغيل أي أمر أو اختبار برمجي، يتدخل نظام التوجيه الذاتي تلقائياً لتشخيص الخطأ، وتطبيق التعديلات البرمجية، وإعادة التشغيل.

### 📊 7. Codebase AST Dependency Graph | مخطط علاقات الأكواد الرمزي
- **Dynamic Dependency Parsing:** Recursively processes JavaScript, TypeScript, and JSX/TSX files using the native TypeScript Compiler API.
- **Interactive Network Visualization:** Maps file nodes and imports using dynamic SVG animations with pan, zoom, node drag, and double-click integration to jump to Monaco code lines.
- **مخطط علاقات برمجية تفاعلي:** يحلل الارتباطات والاستيرادات (Imports) بين الملفات ويبني رسماً بيانياً تفاعلياً متحركاً لتسهيل استكشاف معمارية المشاريع الكبيرة.

### 🔌 8. Third-Party API Sandbox Mocking Suite | محاكاة وتجربة خدمات الطرف الثالث
- **Local Integration Mocks:** Provides sandboxed, local API mocks for popular platforms like Stripe (PaymentIntents/Checkout), Twilio (SMS Messages), and Auth0 (OAuth tokens/Userinfo).
- **Webhook Simulator:** Fire custom trigger webhooks (such as Stripe `payment_intent.succeeded`) directly into target local hooks, complete with captured logs.
- **بيئة محاكاة برمجية مدمجة:** تحاكي بوابات الدفع (Stripe) وخدمات الهوية (Auth0) والرسائل (Twilio) محلياً، مع محاكاة إرسال أحداث الـ Webhooks لتسهيل التجربة والاختبار دون تكلفة.

### 📱 9. Mobile File Tree Toggle & Monaco MD Preview | واجهة متجاوبة ودعم كامل لملفات الماركدون
- **Sidebar Minimizer:** Minimizes the file tree to full width (`w-0`) with a single click to optimize code editing workspace on phone screens.
- **Monaco Markdown Rendering:** Configures Monaco to format `.md` file syntax highlighting, paired with a toggleable side-by-side rich HTML formatting preview.
- **تخصيص كامل للشاشات والمستندات:** زر مخصص لطي شجرة الملفات لإعطاء مساحة أوسع للمحرر على الهواتف، مع دعم كامل لعرض ملفات Markdown وتنسيقها.

### 🌐 10. Multi-Platform Support & LM Studio Integration | التوافق الكامل مع كافة الأنظمة ودمج LM Studio
- **Dynamic Host OS Detection:** Queries server details at launch to inject platform properties (Windows, Linux, Termux) into prompts, ensuring compatible command and path builds.
- **Native search fallback:** Uses a 100% native Node.js text-search directory walker replacing Unix `grep` commands for error-free search across Windows and Unix.
- **Windows cmd.exe & Termux shell:** Spawns `cmd.exe` dynamically on Windows, and resolves Termux sandboxed shell paths (`process.env.SHELL`) on Android.
- **LM Studio Integration:** Support local completions servers mimicking OpenAI chat APIs alongside Ollama and Gemini.
- **دعم كافة أنظمة التشغيل ودمج LM Studio:** نظام ذكي يتعرف على بيئة التشغيل (Windows, Linux, Termux) ويكيف المسارات والأوامر تلقائياً، مع دمج كامل لخوادم LM Studio المحلية.

---

## 🎨 Professional Identity & Theme | الهوية البصرية والتصميم

**Github-devy** implements a bespoke **Cosmic Slate Theme** meticulously optimized for professional developers:
- **Typography:** Display titles rendered in the technical and balanced font **Space Grotesk**, paired with **Inter** for optimal layout readability and **JetBrains Mono** for code rendering.
- **Contrast & Harmony:** Highly polished dark interface layout, accented with rich custom status tags, non-intrusive borders, and smooth react animations powered by `motion`.
- **تصميم سينمائي متكامل:** واجهة مستوحاة من البيئات الاحترافية تستخدم تباينات لونية مريحة للعين ممتدة مع حركات تفاعلية ناعمة تعكس فخامة المنصة واستقرارها.

---

## 🏗️ Architecture / معمارية المنصة

```
  +-------------------------------------------------------------+
  |                        Github-devy                          |
  |                    Client (Vite + React)                      |
  +-------------------------------------------------------------+
         |                       |                        |
         | (WS / HTTP)           | (Previews)             | (API Routes &
         v                       v                        |  Documentation)
  +---------------+      +----------------+               v
  |  Interactive  |      | Service Worker |      +--------------------+
  |   Terminal    |      |  Proxy Interceptor |  | Google Gemini Core |
  |  (xterm.js)   |      | (proxy-sw.js)  |      |   (Server SDK)     |
  +---------------+      +----------------+      +--------------------+
         |                       |                        |
         +-----------------------+------------------------+
                                 |
                                 v
                  +------------------------------+
                  |     Express Server Engine    |
                  |     Node.js Port 9876        |
                  +------------------------------+
         |                       |                        |
         v                       v                        v
  +--------------+   +----------------+   +------------------+
  |  API Routes  |   |  WebSocket     |   |  Documentation   |
  |  (REST/HTTP) |   |  Handlers      |   |  System          |
  +--------------+   +----------------+   +------------------+
         |                       |                        |
         +-----------------------+------------------------+
                                 |
                                 v
                  +------------------------------+
                  |     Secure Sandbox  |
                  |     .agent_workspace     |
                  +------------------------------+
```

---

## 🛠️ Tech Stack / التقنيات المستخدمة

- **Frontend:** React 18+, TypeScript, Tailwind CSS, Vite.
- **Animations:** `motion/react` for smooth state/view transitions.
- **Terminal Engine:** `xterm.js`, `xterm-addon-fit`.
- **Backend:** Node.js, Express.ts with integrated esbuild compilation (`dist/server.cjs`).
- **AI Integration:** `@google/genai` TypeScript SDK.
- **Icons:** `lucide-react`.

---

## 🚀 Getting Started / كيفية التشغيل محلياً

### Prerequisites / المتطلبات الأساسية
- **Node.js** (v18 or higher recommended)
- **NPM** package manager

### Quick Start / خطوات التثبيت

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Setup your environment secrets:**
   Create a local configuration file `.env` in the root folder and add your Gemini secret (never prefix with `VITE_` to protect server-side security):
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Start the Development Workspace:**
   ```bash
   npm run dev
   ```
   *The server dynamically launches on port `9876` with live proxy systems.*

4. **Production Build & Compilation:**
   ```bash
   npm run build
   npm start
   ```

---

## 📂 Key File Structure / هيكل المشروع

```
Github-devy/
├── .agent_workspace/          # Isolated workspace folders (GitIgnored for safety)
├── .env.example               # Environment configuration template
├── .gitignore                 # Git ignore patterns
├── build-server.js            # Server build compilation script
├── dist/                      # Compiled distribution files
├── docs/                      # Comprehensive documentation suite
│   ├── INDEX.md              # Documentation navigation hub
│   ├── DOCUMENTATION.md      # Complete system documentation
│   ├── API_REFERENCE.md       # Comprehensive API documentation
│   ├── DEVELOPMENT_GUIDE.md  # Developer contribution guide
│   ├── DEPLOYMENT_GUIDE.md   # Deployment and operations guide
│   ├── TROUBLESHOOTING_GUIDE.md # Issue resolution guide
│   ├── CONTRIBUTING_GUIDE.md # Contribution guidelines
│   ├── QUICK_START.md        # Quick start guide
│   ├── MIGRATION_GUIDE.md    # Version migration guide
│   ├── FAQ.md               # Frequently asked questions
│   ├── CHANGELOG.md         # Version history
│   └── docs.html            # Interactive documentation experience
├── index.html                 # Main SPA entry point
├── metadata.json              # Project metadata
├── package.json               # Dependency and build configuration
├── server.ts                  # Express & Websocket backend entry point
├── tsconfig.json              # TypeScript compiler configuration
├── vite.config.ts             # Vite build configuration
├── server/                    # Backend server modules
│   ├── routes/                # API route handlers
│   │   ├── ai.ts             # Google Gemini API integration
│   │   ├── browser.ts        # Browser preview & proxy routes
│   │   ├── cmd.ts            # Command execution routes
│   │   ├── db.ts             # Database management routes
│   │   ├── debug.ts          # Debugger interface routes
│   │   ├── fs.ts             # File system operations
│   │   ├── git.ts            # Git operations integration
│   │   ├── package.ts        # Package management routes
│   │   ├── web.ts            # Web scraping & search
│   │   └── workspace.ts      # Workspace management
│   ├── utils/                 # Server utilities
│   │   └── workspace.ts      # Workspace utility functions
│   └── websocket/             # WebSocket handlers
│       ├── terminal.ts       # Terminal WebSocket implementation
│       └── events.ts         # Event management
├── src/                       # Frontend source code
│   ├── App.tsx               # Primary application view manager
│   ├── main.tsx              # React application entry point
│   ├── types.ts              # Unified TS Interfaces & System Types
│   ├── geminiApi.ts          # Google Gemini API client
│   ├── ollama.ts             # Ollama integration client
│   ├── useAgent.ts           # Agent management hook
│   ├── useWorkspace.ts       # Workspace management hook
│   ├── useEventBus.ts        # Event communication system
│   ├── agent/                # AI Agent system
│   │   ├── index.ts          # Agent entry point
│   │   ├── runAgentLoop.ts   # Main agent execution loop
│   │   ├── summarizeHistory.ts # Chat history summarization
│   │   └── useAgentSessions.ts # Session management
│   ├── contexts/             # React contexts
│   │   ├── AgentContext.tsx  # Agent state management
│   │   └── WorkspaceContext.tsx # Workspace state management
│   └── components/           # React components
│       ├── layout/           # Layout components
│       │   ├── ChatLayout.tsx    # Chat interface layout
│       │   ├── IdeLayout.tsx     # IDE interface layout
│       │   └── SidebarLayout.tsx # Sidebar navigation
│       ├── filetree/         # File tree components
│       │   ├── FileModals.tsx    # File operation modals
│       │   ├── ImportExport.tsx  # Import/export functionality
│       │   ├── TermuxBrowser.tsx # Termux file browser
│       │   ├── TreeNode.tsx      # Tree node component
│       │   └── index.tsx         # File tree container
│       ├── terminal/         # Terminal components
│       │   ├── ProcessManager.tsx # Process management UI
│       │   ├── TerminalToolbar.tsx # Terminal toolbar
│       │   ├── index.tsx         # Terminal container
│       │   ├── useTerminalConnection.ts # Terminal connection hook
│       │   └── useTerminalTabs.ts # Terminal tabs management
│       ├── AIBuilder.tsx         # AI-powered UI builder
│       ├── BrowserPreview.tsx    # Sandboxed browser preview
│       ├── ChatMessageUI.tsx     # Chat message interface
│       ├── DatabaseManager.tsx   # Database management interface
│       ├── DebuggerPanel.tsx     # Debugger interface
│       ├── FileTree.tsx          # Main file tree component
│       ├── GitUI.tsx             # Git operations interface
│       ├── PackageManager.tsx    # Package manager interface
│       ├── PlannerPanel.tsx      # AI planning panel
│       ├── PortManager.tsx       # Port management interface
│       ├── SearchUI.tsx          # Search interface
│       ├── SettingsPanel.tsx     # Settings configuration
│       └── TerminalUI.tsx        # Terminal interface
├── tools/                     # Utility scripts
│   ├── browser_test.js        # Browser testing utilities
│   └── platform_test.js       # Platform compatibility tests
└── node_modules/             # NPM dependencies
```

---

## 📚 Documentation / التوثيق

Comprehensive documentation is available in the `/docs` directory:

### Core Documentation
- **[📚 Main Documentation](docs/DOCUMENTATION.md)** - Complete system documentation
- **[📘 API Reference](docs/API_REFERENCE.md)** - Complete API documentation
- **[🛠️ Development Guide](docs/DEVELOPMENT_GUIDE.md)** - Developer contribution guide
- **[🚀 Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Deployment and operations
- **[🔧 Troubleshooting Guide](docs/TROUBLESHOOTING_GUIDE.md)** - Issue resolution
- **[🤝 Contributing Guide](docs/CONTRIBUTING_GUIDE.md)** - Contribution guidelines
- **[📋 Changelog](docs/CHANGELOG.md)** - Version history
- **[📖 Documentation Index](docs/INDEX.md)** - Documentation navigation

### Interactive Documentation
- **[🌐 Live Documentation](/docs)** - Interactive documentation with API tester

### Quick Links
- [Getting Started](#-getting-started--كيفية-التشغيل-محلياً)
- [API Reference](docs/API_REFERENCE.md)
- [Troubleshooting](docs/TROUBLESHOOTING_GUIDE.md)
- [Contributing](docs/CONTRIBUTING_GUIDE.md)

---

## ⚙️ How Terminal Dual-Fallback Works / كيف تعمل الطرفية الاستثنائية؟

The innovative terminal automatically adjusts depending on network settings:
1. When mounted, a dynamic WebSocket client attempts to handshake with `ws://<host>/?workspaceId=X`.
2. If successful, interactive input and process buffers are streamed seamlessly.
3. If blocked or offline, it safely swaps execution to **HTTP Tunneling Mode** where shell commands (`npx`, `npm run`, etc.) are securely executed in `/api/terminal/exec` and feedback is safely buffered to avoid locks.

تم بناء نظام الطرفية ليعمل تحت أي ظروف؛ فإذا كانت جدران الحماية للشبكة تمنع بروتوكول الويب سوكت (WebSockets)، يتم تحويل العميل تلقائياً إلى نظام قنوات HTTP لنقل المدخلات وقراءة المخرجات المخزنة مؤقتاً بالخلفية وبشكل فوري.

---

## 🦙 Ollama Local Integration & Tool-Calling | التكامل مع نماذج Ollama المحلية واستدعاء الأدوات

**Github-devy** has an advanced, deep client-side integration built specifically for **Ollama**, allowing developers to build and customize with fully local, private generative models:

- **Dynamic Model Discovery:** Easily input your local or server Ollama endpoint (e.g., `http://localhost:11434`) and the system automatically fetches all installed models (e.g., `llama3`, `mistral`, `codegemma`, `qwen`) by querying Ollama's active tags endpoint.
- **Bespoke Emulator Schema for Local Models:** Since local models have varying support for structured function calling, `src/ollama.ts` embeds a client-side emulation engine with a tailored `TOOLS_SCHEMA` to direct models on executing workspace tasks step-by-step.
- **Granular Desktop & Sandbox Execution:** Enables local models to perform critical sandbox operations safely such as:
  - Reading, writing, and surgically replacing content in files.
  - Recursively mapping directory-trees and listing available works.
  - Executing server-side commands with standard sandbox privileges.
  - Searching and scraping live websites for developer reference.
  - Navigating, typing, and capturing viewport/HTML state buffers of the sandbox's embedded browser preview.
  - Seamlessly stashing and committing changes to GitHub!

### كيف يعمل تكامل Ollama ومميزاته البرمجية؟
1. **تحديث وقراءة لحظية للنماذج:** بمجرد تخصيص عنوان الـ API الخاص بـ Ollama في الحزمة، تتواصل المنصة وتجلب النماذج الجاهزة فوراً في لوحة التحكم.
2. **محاكاة استدعاء الوظائف (Function-Calling Simulation):** تم تزويد النظام بمحاكي ذكي يترجم رغبة النماذج المحلية إلى مدخلات برمجية دقيقة للقيام بالعمليات خطوة بخطوة.
3. **أمان تام وقدرة تشغيل محلية مجانية (Offline-Friendly):** تخلص من رسوم الاستهلاك السحابية وتحكم في كامل ملفاتك وبرامجك محلياً بشكل سري وآمن مستعيناً بالنوى البرمجية لجهازك الخاص وبتكامل تام مع مساحات العمل.

---

## ⚙️ Configuration / الإعدادات

### Environment Variables / متغيرات البيئة

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

### Settings Structure / هيكل الإعدادات

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

### Workspace Configuration / إعداد مساحات العمل

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

## 📡 API Reference / مرجع واجهة البرمجة

### REST API Endpoints / نقاط نهاية REST API

#### Workspace Management / إدارة مساحات العمل

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

#### File System Operations / عمليات نظام الملفات

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

#### Command Execution / تنفيذ الأوامر

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

#### Git Operations / عمليات Git

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

#### AI Integration / تكامل الذكاء الاصطناعي

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

#### Database Operations / عمليات قاعدة البيانات

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

### WebSocket API / واجهة WebSocket

#### Terminal Connection / اتصال الطرفية

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

#### Event Types / أنواع الأحداث

- `output`: Terminal output data
- `error`: Error messages
- `exit`: Process exit event
- `status`: Connection status updates

---

## 🚀 Advanced Features / الميزات المتقدمة

### Codebase RAG & AST Indexing / نظام استرجاع الأكواد الدلالي والفهرسة الرمزية

The platform features a built-in symbol-aware **Retrieval-Augmented Generation (RAG)** engine to locate code snippets dynamically:
1. **Symbol-Aware AST Chunking:** Scans workspace files (TypeScript, JavaScript, Python, HTML, CSS, JSON, Markdown). JS/TS files are parsed using the native TypeScript compiler AST parser; Python files are parsed using indentation block layouts to isolate clean function and class declarations.
2. **Hybrid Retrieval Scorer:**
   - **Semantic Similarity:** Computes cosine vector similarity using Google Gemini's `text-embedding-004` embeddings API.
   - **Keyword Relevance:** Calculates word term frequency (TF-IDF) focusing on file paths and symbol names.
   - **Merged Scoring:** Computes `Score = (TF-IDF * 0.4) + (Semantic * 0.6)` for top-tier matching.
3. **Zero-Configuration indexing:** If the index doesn't exist, search routes build it automatically in the background, keeping codebase search zero-setup.

*REST API endpoints:*
* `POST /api/rag/status` - Checks if index files exist.
* `POST /api/rag/index` - Rebuilds workspace symbol index and embeddings.
* `POST /api/rag/search` - Queries the codebase and returns top matching snippets.

*Agent Tools:*
* `search_codebase_rag({ query, limit })`
* `index_codebase_rag()`

---

### Asynchronous Multi-Agent Background Orchestration / تشغيل الوكلاء في الخلفية

For complex refactoring, planning, or debugging pipelines, the orchestrator allows launching specialized agents concurrently in the background:
1. **Asynchronous Spawning:** Pass `background: true` to `invoke_subagent` or `invoke_parallel_subagents` to spin up background loops immediately, returning a running handle.
2. **Iteration and Timeout Guards:** Specify `maxIterations` (1-30) and `timeoutSeconds` (e.g. 120 seconds) to prevent runaway loops or OOM crashes in local models. Timeout triggers trigger abort controller signals dynamically.
3. **Status Tracking & Querying:**
   - Use `list_subagents` to list all spawned background workers and their execution timestamps.
   - Use `get_subagent_status({ agentId })` to poll a background worker's result, execution logs, and final report.

*Agent Tools:*
* `invoke_subagent({ agentType, task, maxIterations, timeoutSeconds, background })`
* `invoke_parallel_subagents({ agents: [{ agentType, task, maxIterations, timeoutSeconds }], background })`
* `get_subagent_status({ agentId })`
* `list_subagents()`

---

### Token Efficiency & Context Safety / حماية السياق وكفاءة التوكنز

To avoid local LLM crashes or expensive token bloat, the platform implements context guardrails:
1. **Line-Range Reading:** Large files are truncated to ~32KB characters by filesystem endpoints. The system instructs LLMs to use `read_file_lines` for targeted reads.
2. **Screenshot Payload Stripping:** Tool execution hooks catch base64 image data URLs from `browser_screenshot` and replace them with a tiny placeholder before sending message arrays to the LLM. This prevents text payload bloat while keeping full images rendering in the IDE chat view.

---

### Custom Tool Development / تطوير الأدوات المخصصة

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

### Plugin Development / تطوير الإضافات

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

### Security Best Practices / أفضل ممارسات الأمان

1. **Workspace Isolation**: Ensure proper sandboxing
2. **API Key Protection**: Never expose keys in client code
3. **Input Validation**: Validate all user inputs
4. **Rate Limiting**: Implement API rate limits
5. **HTTPS Only**: Use HTTPS in production
6. **Regular Updates**: Keep dependencies updated

### Performance Optimization / تحسين الأداء

1. **Enable gzip compression**
2. **Configure CDN for static assets**
3. **Enable HTTP/2**
4. **Optimize database queries**
5. **Implement caching strategies**

---

## 🔧 Troubleshooting / حل المشاكل

### Common Issues / المشاكل الشائعة

#### Terminal Connection Issues / مشاكل اتصال الطرفية

**Problem**: Terminal not connecting or showing errors

**Solutions**:
1. Check WebSocket port accessibility
2. Verify firewall settings
3. Try HTTP fallback mode
4. Check workspace permissions

#### AI Integration Problems / مشاكل تكامل الذكاء الاصطناعي

**Problem**: AI responses failing or timing out

**Solutions**:
1. Verify API keys are correct
2. Check network connectivity
3. Ensure Ollama is running (for local models)
4. Reduce context window size

#### File System Errors / أخطاء نظام الملفات

**Problem**: Cannot read/write files

**Solutions**:
1. Check workspace permissions
2. Verify disk space availability
3. Check file system integrity
4. Ensure paths are correct

#### Build Failures / فشل البناء

**Problem**: Build process fails

**Solutions**:
1. Clear node_modules and reinstall
2. Update dependencies
3. Check TypeScript errors
4. Verify environment variables

### Debug Mode / وضع التصحيح

Enable debug logging:

```env
DEBUG=github-devy:*
NODE_ENV=development
```

### Log Files / ملفات السجلات

Check application logs:

```bash
# Terminal logs
tail -f .agent_workspace/[workspace-id]/terminal.log

# Error logs
tail -f logs/error.log

# Access logs
tail -f logs/access.log
```

---

## 🤝 Contributing / المساهمة

We welcome contributions! Please see our contributing guidelines for details.

### Development Workflow / سير العمل التطويري

1. Fork the repository
2. Create feature branch
3. Make your changes
4. Add tests
5. Submit pull request

### Code Review Process / عملية مراجعة الكود

1. Automated checks pass
2. Manual review by maintainers
3. Feedback integration
4. Approval and merge

### Coding Standards / معايير البرمجة

- **TypeScript**: Strict mode enabled
- **React**: Functional components with hooks
- **Styling**: Tailwind CSS utility classes
- **Formatting**: Prettier configuration
- **Linting**: ESLint with TypeScript rules

---

## 📄 License / الترخيص

Professional Workspace Project designed & crafted perfectly to bridge developer ecosystems with generative AI workflows.

**Github-devy** © 2026. All rights reserved.
