# API Reference Guide

Complete API reference for Github-devy's REST and WebSocket endpoints.

## Base URL

```
http://localhost:9876
```

## Authentication

Most endpoints require workspace identification through the `workspaceId` parameter. For AI endpoints, API keys should be configured via environment variables.

---

## REST API Endpoints

### Workspace Management

#### List All Workspaces

```http
GET /api/workspaces
```

**Response:**
```json
{
  "workspaces": [
    {
      "id": "workspace-123",
      "name": "my-project",
      "created": "2024-01-01T00:00:00Z",
      "lastModified": "2024-01-02T12:00:00Z"
    }
  ]
}
```

#### Create New Workspace

```http
POST /api/workspace/create
Content-Type: application/json

{
  "name": "my-new-project",
  "template": "react-typescript"
}
```

**Response:**
```json
{
  "workspaceId": "workspace-456",
  "name": "my-new-project",
  "path": ".agent_workspace/workspace-456"
}
```

#### Switch Workspace

```http
POST /api/workspace/switch
Content-Type: application/json

{
  "workspaceId": "workspace-123"
}
```

**Response:**
```json
{
  "success": true,
  "workspaceId": "workspace-123"
}
```

#### Delete Workspace

```http
DELETE /api/workspace/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Workspace deleted successfully"
}
```
#### Get Host Environment Details

```http
GET /api/environment/detect
```

**Response:**
```json
{
  "success": true,
  "platform": "linux",
  "shell": "/bin/bash",
  "isWindows": false,
  "isLinux": true,
  "isMac": false,
  "nodeVersion": "v20.10.0",
  "cwd": "/data/data/com.termux/files/home/Github-devy"
}
```

---

### File System Operations

#### List Directory Contents

```http
POST /api/fs/list
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "path": "/src"
}
```

**Response:**
```json
{
  "files": [
    {
      "name": "App.tsx",
      "path": "/src/App.tsx",
      "isDirectory": false,
      "size": 1024
    },
    {
      "name": "components",
      "path": "/src/components",
      "isDirectory": true,
      "size": 0
    }
  ]
}
```

#### Read File Content

```http
POST /api/fs/read
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "path": "/src/App.tsx"
}
```

**Response:**
```json
{
  "content": "import React from 'react';\n\nexport function App() {\n  return <div>Hello World</div>;\n}",
  "encoding": "utf-8"
}
```

#### Read File Lines (Large Files)

```http
POST /api/fs/read-lines
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "path": "/src/large-file.ts",
  "offset": 1,
  "limit": 100
}
```

**Response:**
```json
{
  "lines": [
    "line 1 content",
    "line 2 content"
  ],
  "totalLines": 1000,
  "offset": 1,
  "limit": 100
}
```

#### Write File Content

```http
POST /api/fs/write
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "path": "/src/new-file.ts",
  "content": "export const hello = 'world';"
}
```

**Response:**
```json
{
  "success": true,
  "path": "/src/new-file.ts"
}
```

#### Replace in File

```http
POST /api/fs/replace
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "path": "/src/App.tsx",
  "search": "Hello World",
  "replace": "Hello Universe"
}
```

**Response:**
```json
{
  "success": true,
  "replacements": 1
}
```

#### Delete File or Directory

```http
POST /api/fs/delete
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "path": "/src/old-file.ts"
}
```

**Response:**
```json
{
  "success": true,
  "path": "/src/old-file.ts"
}
```

#### Search Files

```http
POST /api/fs/search
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "query": "function",
  "path": "/src",
  "exclude": ["node_modules", ".git"]
}
```

**Response:**
```json
{
  "results": [
    {
      "path": "/src/App.tsx",
      "line": 5,
      "content": "export function App() {"
    }
  ]
}
```

---

### Command Execution

#### Execute Command

```http
POST /api/cmd/exec
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "command": "npm run dev",
  "sessionId": "session-abc123"
}
```

**Response:**
```json
{
  "sessionId": "session-abc123",
  "status": "running",
  "pid": 12345
}
```

#### Get Command Output

```http
GET /api/cmd/output/session-abc123
```

**Response:**
```json
{
  "sessionId": "session-abc123",
  "output": "Starting development server...",
  "error": "",
  "status": "running"
}
```

#### Kill Process

```http
POST /api/cmd/kill
Content-Type: application/json

{
  "sessionId": "session-abc123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Process killed successfully"
}
```

---

### Git Operations

#### Get Repository Status

```http
POST /api/git/status
Content-Type: application/json

{
  "workspaceId": "workspace-123"
}
```

**Response:**
```json
{
  "isRepository": true,
  "currentBranch": "main",
  "files": [
    {
      "path": "src/App.tsx",
      "state": "modified"
    }
  ]
}
```

#### Initialize Repository

```http
POST /api/git/init
Content-Type: application/json

{
  "workspaceId": "workspace-123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Repository initialized"
}
```

#### Clone Repository

```http
POST /api/git/clone
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "url": "https://github.com/user/repo.git"
}
```

**Response:**
```json
{
  "success": true,
  "path": ".agent_workspace/workspace-123/repo"
}
```

#### Commit Changes

```http
POST /api/git/commit
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "message": "Add new feature",
  "files": ["src/App.tsx"]
}
```

**Response:**
```json
{
  "success": true,
  "commitHash": "abc123def456"
}
```

#### Push Changes

```http
POST /api/git/push
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "force": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Changes pushed successfully"
}
```

#### Pull Changes

```http
POST /api/git/pull
Content-Type: application/json

{
  "workspaceId": "workspace-123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Changes pulled successfully"
}
```

#### Get Commit History

```http
POST /api/git/log
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "limit": 10
}
```

**Response:**
```json
{
  "commits": [
    {
      "hash": "abc123",
      "message": "Add new feature",
      "author": "John Doe",
      "date": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### AI Integration

#### Generate AI Response (Gemini)

```http
POST /api/gemini/chat
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": "Create a React component"
    }
  ],
  "model": "gemini-2.5-flash",
  "tools": [
    {
      "name": "write_file",
      "description": "Write file content"
    }
  ]
}
```

**Response:**
```json
{
  "content": "Here's a React component for you...",
  "toolInvocations": [
    {
      "id": "tool-123",
      "name": "write_file",
      "args": {
        "path": "/src/Component.tsx",
        "content": "..."
      },
      "result": "File written successfully"
    }
  ]
}
```

#### Stream AI Response

```http
POST /api/gemini/stream
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": "Explain React hooks"
    }
  ],
  "model": "gemini-2.5-flash"
}
```

**Response (Server-Sent Events):**
```
data: {"content": "React"}

data: {"content": " hooks"}

data: {"content": " are..."}
```

#### Generate AI Response (Ollama)

```http
POST /api/ollama/chat
Content-Type: application/json

{
  "model": "llama3",
  "messages": [
    {
      "role": "user",
      "content": "Write a function"
    }
  ],
  "tools": []
}
```

**Response:**
```json
{
  "content": "Here's a function...",
  "model": "llama3"
}
```

---

### Database Operations

#### List Databases

```http
POST /api/db/list
Content-Type: application/json

{
  "workspaceId": "workspace-123"
}
```

**Response:**
```json
{
  "databases": [
    ".agent_workspace/workspace-123/database.db"
  ]
}
```

#### Get Tables

```http
POST /api/db/tables
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "dbPath": "database.db"
}
```

**Response:**
```json
{
  "tables": ["users", "posts", "comments"]
}
```

#### Execute Query

```http
POST /api/db/query
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "dbPath": "database.db",
  "query": "SELECT * FROM users"
}
```

**Response:**
```json
{
  "type": "select",
  "columns": ["id", "name", "email"],
  "rows": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    }
  ]
}
```

---

### Package Management

#### List Packages

```http
POST /api/package/list
Content-Type: application/json

{
  "workspaceId": "workspace-123"
}
```

**Response:**
```json
{
  "hasPackageJson": true,
  "name": "my-project",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

#### Install Package

```http
POST /api/package/install
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "packages": ["lodash", "axios"],
  "dev": false
}
```

**Response:**
```json
{
  "sessionId": "install-session-123",
  "status": "installing"
}
```

#### Search Packages

```http
POST /api/package/search
Content-Type: application/json

{
  "query": "react"
}
```

**Response:**
```json
{
  "results": [
    {
      "name": "react",
      "version": "18.2.0",
      "description": "React JavaScript library"
    }
  ]
}
```

---

### Browser Preview

#### Navigate to URL

```http
POST /api/browser/navigate
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "url": "http://localhost:3000"
}
```

**Response:**
```json
{
  "success": true,
  "url": "http://localhost:3000"
}
```

#### Get Page State

```http
POST /api/browser/state
Content-Type: application/json

{
  "workspaceId": "workspace-123"
}
```

**Response:**
```json
{
  "url": "http://localhost:3000",
  "title": "My App",
  "html": "<html>...</html>"
}
```

#### Click Element

```http
POST /api/browser/click
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "selector": "#submit-button"
}
```

**Response:**
```json
{
  "success": true
}
```

#### Type in Element

```http
POST /api/browser/type
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "selector": "#username",
  "text": "john_doe"
}
```

**Response:**
```json
{
  "success": true
}
```

#### Take Screenshot

```http
POST /api/browser/screenshot
Content-Type: application/json

{
  "workspaceId": "workspace-123"
}
```

**Response:**
```json
{
  "success": true,
  "path": ".agent_workspace/workspace-123/screenshots/screenshot-123.png"
}
```

---

### Web Operations

#### Web Search

```http
POST /api/web/search
Content-Type: application/json

{
  "query": "React hooks documentation"
}
```

**Response:**
```json
{
  "results": [
    {
      "title": "React Hooks Documentation",
      "url": "https://react.dev/reference/react",
      "snippet": "Hooks are functions..."
    }
  ]
}
```

#### Web Browse

```http
POST /api/web/browse
Content-Type: application/json

{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "content": "<html>...</html>",
  "title": "Example Domain"
}
```

---

### Codebase RAG Operations

Endpoints to index, search, and monitor symbol-level indexing of the codebase.

#### Get Indexing Status

```http
POST /api/rag/status
Content-Type: application/json

{
  "workspaceId": "my-workspace-id"
}
```

**Response:**
```json
{
  "exists": true,
  "indexedAt": 1718534091000,
  "chunksCount": 142,
  "workspaceId": "my-workspace-id"
}
```

#### Rebuild Codebase Index

Reads all workspace source code files, parses TypeScript/JavaScript (via AST Compiler API) and Python, and generates TF-IDF terms as well as semantic vectors (via Gemini `text-embedding-004`).

```http
POST /api/rag/index
Content-Type: application/json

{
  "workspaceId": "my-workspace-id",
  "clientApiKey": "optional_gemini_api_key_override"
}
```

**Response:**
```json
{
  "success": true,
  "indexedAt": 1718534092000,
  "chunksCount": 142,
  "embeddedCount": 142
}
```

#### Search Codebase (Hybrid RAG Search)

Queries the workspace index using sparse word overlap (TF-IDF keyword matching on declarations and path) combined with dense cosine similarities (semantic embeddings matching).

```http
POST /api/rag/search
Content-Type: application/json

{
  "workspaceId": "my-workspace-id",
  "query": "safePath traversal verification",
  "clientApiKey": "optional_gemini_api_key_override",
  "limit": 5
}
```

**Response:**
```json
{
  "success": true,
  "query": "safePath traversal verification",
  "results": [
    {
      "filePath": "server/utils/workspace.ts",
      "name": "safePath",
      "type": "function",
      "startLine": 49,
      "endLine": 70,
      "content": "export async function safePath(id: string, subPath: string) {\n  const baseDir = ...",
      "keywordScore": 4.5,
      "vectorScore": 0.895,
      "finalScore": 0.717
    }
  ]
}
```

### AST Dependency Graph Operations

#### Get Codebase AST Graph

Analyzes workspace files using the TypeScript Compiler API to return a nodes-and-links graph representation of file dependencies and top-level exported symbols.

```http
POST /api/ast/graph
Content-Type: application/json

{
  "workspaceId": "my-workspace-id"
}
```

**Response:**
```json
{
  "nodes": [
    { "id": "src/main.tsx", "label": "main.tsx", "type": "file" },
    { "id": "src/App.tsx", "label": "App.tsx", "type": "file" }
  ],
  "links": [
    { "source": "src/main.tsx", "target": "src/App.tsx", "symbols": ["App"] }
  ]
}
```

---

### Third-Party API Sandbox Mocking

Provides local, sandboxed implementations for Stripe, Twilio, and Auth0 APIs for error-free local verification and webhook testing.

#### Stripe Payment Intents Mock

```http
POST /api/sandbox/stripe/v1/payment_intents
Content-Type: application/json

{
  "amount": 2000,
  "currency": "usd"
}
```

**Response:**
```json
{
  "id": "pi_mock_12345",
  "object": "payment_intent",
  "amount": 2000,
  "currency": "usd",
  "status": "requires_payment_method"
}
```

#### Get Sandbox Request Logs

```http
GET /api/sandbox/logs
```

**Response:**
```json
{
  "logs": [
    {
      "id": "log_1718534092000",
      "timestamp": "2026-06-16T12:00:00.000Z",
      "method": "POST",
      "path": "/stripe/v1/payment_intents",
      "headers": { "content-type": "application/json" },
      "body": { "amount": 2000, "currency": "usd" }
    }
  ]
}
```

#### Trigger Webhook Event Simulator

```http
POST /api/sandbox/trigger-webhook
Content-Type: application/json

{
  "url": "http://localhost:3000/webhooks/stripe",
  "eventType": "payment_intent.succeeded"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook dispatched successfully",
  "status": 200
}
```

---

## WebSocket API

### Terminal WebSocket

#### Connection

```javascript
const ws = new WebSocket(`ws://localhost:9876/terminal?workspaceId=workspace-123`);
```

#### Message Format

**Send Command:**
```json
{
  "type": "command",
  "command": "npm run dev",
  "sessionId": "session-abc123"
}
```

**Resize Terminal:**
```json
{
  "type": "resize",
  "cols": 80,
  "rows": 24
}
```

**Kill Process:**
```json
{
  "type": "kill",
  "sessionId": "session-abc123"
}
```

#### Response Format

**Output:**
```json
{
  "type": "output",
  "sessionId": "session-abc123",
  "data": "Starting development server...",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Error:**
```json
{
  "type": "error",
  "sessionId": "session-abc123",
  "error": "Command failed",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Exit:**
```json
{
  "type": "exit",
  "sessionId": "session-abc123",
  "code": 0,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

- `INVALID_REQUEST`: Invalid request parameters
- `UNAUTHORIZED`: Authentication required
- `NOT_FOUND`: Resource not found
- `INTERNAL_ERROR`: Internal server error
- `WORKSPACE_NOT_FOUND`: Workspace does not exist
- `FILE_NOT_FOUND`: File does not exist
- `COMMAND_FAILED`: Command execution failed

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Standard endpoints**: 100 requests per minute
- **AI endpoints**: 20 requests per minute
- **WebSocket connections**: 10 concurrent connections per workspace

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## Versioning

The API is versioned using URL paths. Current version: `v1`

```
/api/v1/workspaces
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { GithubDevyClient } from '@github-devy/sdk';

const client = new GithubDevyClient({
  baseUrl: 'http://localhost:9876',
  workspaceId: 'workspace-123'
});

// File operations
await client.fs.write('/src/hello.ts', 'export const hello = "world";');
const content = await client.fs.read('/src/hello.ts');

// Command execution
const session = await client.cmd.exec('npm run dev');
const output = await session.getOutput();

// Git operations
await client.git.commit('Add new feature');
await client.git.push();
```

### Python

```python
from github_devy import GithubDevyClient

client = GithubDevyClient(
    base_url='http://localhost:9876',
    workspace_id='workspace-123'
)

# File operations
client.fs.write('/src/hello.ts', 'export const hello = "world";')
content = client.fs.read('/src/hello.ts')

# Command execution
session = client.cmd.exec('npm run dev')
output = session.get_output()

# Git operations
client.git.commit('Add new feature')
client.git.push()
```

---

*Last updated: June 2026*