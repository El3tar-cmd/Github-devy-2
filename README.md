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

### 🤖 3. Multi-Agent AI Core | نظام ذكاء اصطناعي متعدد الوكلاء
- **Google Gemini Integration:** State-of-the-art server-side integration powered by the official `@google/genai` SDK for complex code generation, debugging, and environment reasoning.
- **Local Ollama Integration:** Dynamic support for offline, locally loaded LLMs directly mapping developer prompts.
- **Context-Aware Reasoning:** Seamlessly feeds workspace directory maps, file contents, and error outputs directly into the LLMs.
- **مساعد برمجى متكامل:** يدعم جيميناي (Gemini API) على الطرف الخلفي (Backend) و أوبن لاما (Ollama) لتعديل وضخ الأكواد وحل المشكلات برمجياً دون مغادرة البيئة.

### 📁 4. Reactive Workspace and File System Explorer | مدير مساحات العمل والملفات
- **Dynamic File Tree:** Fully responsive tree component mapping real file directories on the server. Features search, creation, editing, and immediate syncing.
- **Workspace Sandboxing:** Create and switch between distinct developer workspaces with fully isolated dependency structures.
- **متصفح ملفات مرن:** تحكم مرن في شجرة الملفات مع المزامنة اللحظية مع خادم لضمان دقة العمل مع إمكانية عزل المشاريع في مساحات عمل منفصلة.

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
  |                       Client (Vite)                         |
  +-------------------------------------------------------------+
         |                       |                        |
         | (WS / HTTP)           | (Previews)             | (API Route Proxies &
         v                       v                        |  Server-side Secrets)
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
                  |     Node.js Port 3000        |
                  +------------------------------+
                                 |
                        +-----------------+
                        | Secure Sandbox  |
                        | .agent_workspace|
                        +-----------------+
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
   *The server dynamically launches on port `3000` with live proxy systems.*

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
├── docs.html                  # Interactive documentation page
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

### 📄 License

Professional Workspace Project designed & crafted perfectly to bridge developer ecosystems with generative AI workflows.

**Github-devy** © 2026. All rights reserved.
