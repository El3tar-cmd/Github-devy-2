# Development Guide

Complete guide for developing and contributing to Github-devy.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Environment](#development-environment)
3. [Project Structure](#project-structure)
4. [Coding Standards](#coding-standards)
5. [Testing](#testing)
6. [Building](#building)
7. [Debugging](#debugging)
8. [Contributing](#contributing)

---

## Getting Started

### Prerequisites

- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **Git**: Latest version
- **TypeScript**: v5.8 or higher

### Initial Setup

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

The development server will start on `http://localhost:9876`

---

## Development Environment

### IDE Setup

#### VS Code

Recommended extensions:
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- GitLens

#### VS Code Settings

Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

### Environment Variables

Development environment variables:

```env
# Development
NODE_ENV=development
PORT=9876

# AI Configuration
GEMINI_API_KEY=your_dev_key
OLLAMA_URL=http://localhost:11434

# Debug
DEBUG=github-devy:*
```

---

## Project Structure

### Directory Layout

```
Github-devy/
├── src/                          # Frontend source
│   ├── components/              # React components
│   │   ├── layout/             # Layout components
│   │   ├── filetree/           # File tree components
│   │   ├── terminal/           # Terminal components
│   │   ├── AIBuilder.tsx       # AI UI builder
│   │   ├── BrowserPreview.tsx  # Browser preview
│   │   ├── ChatMessageUI.tsx   # Chat interface
│   │   ├── DatabaseManager.tsx # Database manager
│   │   ├── DebuggerPanel.tsx   # Debugger
│   │   ├── FileTree.tsx        # File tree
│   │   ├── GitUI.tsx           # Git interface
│   │   ├── PackageManager.tsx  # Package manager
│   │   ├── PlannerPanel.tsx    # AI planner
│   │   ├── PortManager.tsx     # Port manager
│   │   ├── SearchUI.tsx        # Search interface
│   │   └── SettingsPanel.tsx   # Settings
│   ├── contexts/               # React contexts
│   │   ├── AgentContext.tsx   # Agent state
│   │   └── WorkspaceContext.tsx # Workspace state
│   ├── agent/                  # AI agent system
│   │   ├── index.ts           # Agent entry
│   │   ├── runAgentLoop.ts    # Agent execution
│   │   ├── summarizeHistory.ts # History summarization
│   │   └── useAgentSessions.ts # Session management
│   ├── App.tsx                # Main app component
│   ├── main.tsx               # Entry point
│   ├── types.ts               # TypeScript types
│   ├── geminiApi.ts           # Gemini API client
│   ├── ollama.ts              # Ollama client
│   ├── useAgent.ts            # Agent hook
│   ├── useWorkspace.ts        # Workspace hook
│   └── useEventBus.ts         # Event system
├── server/                     # Backend source
│   ├── routes/                # API routes
│   │   ├── ai.ts             # AI endpoints
│   │   ├── browser.ts        # Browser endpoints
│   │   ├── cmd.ts            # Command endpoints
│   │   ├── db.ts             # Database endpoints
│   │   ├── debug.ts          # Debugger endpoints
│   │   ├── fs.ts             # File system endpoints
│   │   ├── git.ts            # Git endpoints
│   │   ├── package.ts        # Package endpoints
│   │   ├── web.ts            # Web endpoints
│   │   └── workspace.ts      # Workspace endpoints
│   ├── utils/                 # Server utilities
│   │   └── workspace.ts      # Workspace utilities
│   └── websocket/             # WebSocket handlers
│       ├── terminal.ts       # Terminal WebSocket
│       └── events.ts         # Event management
├── public/                     # Static assets
├── tools/                      # Build tools
│   ├── browser_test.js        # Browser tests
│   └── platform_test.js       # Platform tests
├── .agent_workspace/          # Workspace storage (gitignored)
├── dist/                      # Build output
├── docs/                      # Documentation
├── tests/                     # Test files
├── .env.example              # Environment template
├── .gitignore                # Git ignore rules
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── vite.config.ts            # Vite config
└── server.ts                 # Server entry
```

### Component Architecture

#### Component Hierarchy

```
App
├── WorkspaceProvider
│   └── WorkspaceContext
├── AgentProvider
│   └── AgentContext
└── MainApp
    ├── SidebarLayout
    │   ├── Navigation
    │   └── WorkspaceSelector
    ├── ChatLayout
    │   ├── ChatMessageUI
    │   └── InputArea
    └── IdeLayout
        ├── EditorPanel
        ├── BrowserPreview
        ├── TerminalUI
        ├── GitUI
        ├── PackageManager
        ├── DatabaseManager
        ├── DebuggerPanel
        ├── AIBuilder
        └── PlannerPanel
```

#### Data Flow

```
User Action → Component → Context/Hook → API Call → Server → Response → State Update → Re-render
```

---

## Coding Standards

### TypeScript Guidelines

#### Type Definitions

Always define interfaces for complex objects:

```typescript
// Good
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// Bad
const user: any = { id: 1, name: 'John' };
```

#### Type Safety

Use strict type checking:

```typescript
// Good
function processUser(user: User): ProcessedUser {
  return {
    ...user,
    processed: true
  };
}

// Bad
function processUser(user: any) {
  return { ...user, processed: true };
}
```

#### Generic Types

Use generics for reusable components:

```typescript
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return <ul>{items.map(renderItem)}</ul>;
}
```

### React Best Practices

#### Component Structure

```typescript
// Good: Clear separation of concerns
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  // Hooks
  const [state, setState] = useState<string>('');
  
  // Effects
  useEffect(() => {
    // Effect logic
  }, []);
  
  // Handlers
  const handleClick = () => {
    onAction();
  };
  
  // Render
  return (
    <div>
      <h1>{title}</h1>
      <button onClick={handleClick}>Action</button>
    </div>
  );
}
```

#### Custom Hooks

Extract reusable logic into custom hooks:

```typescript
function useWorkspace(workspaceId: string) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchWorkspace(workspaceId)
      .then(setWorkspace)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [workspaceId]);
  
  return { workspace, loading, error };
}
```

#### Performance Optimization

Use memoization for expensive operations:

```typescript
// Good: Memoized expensive computation
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

// Good: Memoized callback
const handleClick = useCallback(() => {
  doSomething(dependency);
}, [dependency]);

// Good: Memoized component
const ExpensiveComponent = memo(function ExpensiveComponent({ data }: Props) {
  return <div>{/* expensive rendering */}</div>;
});
```

### CSS/Tailwind Guidelines

#### Utility-First Approach

```typescript
// Good: Using Tailwind utilities
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">

// Bad: Custom CSS classes
<div className="my-custom-class">
```

#### Responsive Design

```typescript
// Good: Responsive utilities
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Good: Conditional classes
<div className={cn(
  "base-class",
  isActive && "active-class",
  isDisabled && "disabled-class"
)}>
```

### API Design

#### RESTful Conventions

```typescript
// Good: RESTful endpoints
GET    /api/workspaces           // List workspaces
POST   /api/workspaces           // Create workspace
GET    /api/workspaces/:id       // Get workspace
PUT    /api/workspaces/:id       // Update workspace
DELETE /api/workspaces/:id       // Delete workspace
```

#### Error Handling

```typescript
// Good: Consistent error responses
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  return { 
    success: false, 
    error: error.message,
    code: 'OPERATION_FAILED'
  };
}
```

---

## Testing

### Unit Testing

Create test files alongside source files:

```typescript
// MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders title correctly', () => {
    render(<MyComponent title="Test Title" onAction={jest.fn()} />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });
  
  it('calls onAction when button is clicked', () => {
    const onAction = jest.fn();
    render(<MyComponent title="Test" onAction={onAction} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(onAction).toHaveBeenCalled();
  });
});
```

### Integration Testing

Test component interactions:

```typescript
describe('Workspace Integration', () => {
  it('creates and switches workspaces', async () => {
    const { result } = renderHook(() => useWorkspaceManager());
    
    await act(async () => {
      await result.current.createWorkspace('test-workspace');
    });
    
    expect(result.current.workspaces).toHaveLength(1);
  });
});
```

### E2E Testing

End-to-end testing with Playwright:

```typescript
// e2e/workspace.spec.ts
import { test, expect } from '@playwright/test';

test('workspace creation flow', async ({ page }) => {
  await page.goto('http://localhost:9876');
  
  await page.click('[data-testid="create-workspace"]');
  await page.fill('[data-testid="workspace-name"]', 'test-workspace');
  await page.click('[data-testid="submit"]');
  
  await expect(page.locator('[data-testid="workspace-list"]')).toContainText('test-workspace');
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test MyComponent.test.tsx

# Run tests in watch mode
npm test -- --watch

# Run E2E tests
npm run test:e2e

# Generate coverage report
npm test -- --coverage
```

---

## Building

### Development Build

```bash
# Start development server
npm run dev

# Development server with HMR disabled
DISABLE_HMR=true npm run dev
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start

# Build and start
npm run build && npm start
```

### Build Optimization

#### Code Splitting

```typescript
// Good: Lazy load components
const AIBuilder = lazy(() => import('./components/AIBuilder'));
const DebuggerPanel = lazy(() => import('./components/DebuggerPanel'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <AIBuilder />
    </Suspense>
  );
}
```

#### Tree Shaking

Ensure unused code is eliminated:

```typescript
// Good: Import specific functions
import { debounce } from 'lodash-es';

// Bad: Import entire library
import _ from 'lodash';
```

---

## Debugging

### Client-Side Debugging

#### React DevTools

Install React DevTools browser extension for component inspection.

#### Console Debugging

```typescript
// Good: Structured logging
console.log('Workspace state:', { workspaceId, files, loading });

// Good: Error logging
console.error('Failed to load workspace:', error);

// Good: Performance logging
console.time('expensiveOperation');
expensiveOperation();
console.timeEnd('expensiveOperation');
```

#### Breakpoint Debugging

Use VS Code debugger configuration:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:9876",
      "webRoot": "${workspaceFolder}"
    }
  ]
}
```

### Server-Side Debugging

#### Node.js Debugging

```bash
# Debug with inspect
node --inspect server.ts

# Debug with inspect-brk (break on start)
node --inspect-brk server.ts
```

#### VS Code Debug Configuration

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Logging

#### Debug Mode

Enable debug logging:

```env
DEBUG=github-devy:*
```

#### Custom Logging

```typescript
import debug from 'debug';

const log = debug('github-devy:workspace');
const errorLog = debug('github-devy:error');

log('Workspace created:', workspaceId);
errorLog('Failed to create workspace:', error);
```

---

## Contributing

### Workflow

1. **Fork the repository**
2. **Create feature branch**
```bash
git checkout -b feature/my-feature
```

3. **Make changes**
4. **Write tests**
5. **Run tests**
```bash
npm test
npm run lint
```

6. **Commit changes**
```bash
git commit -m "feat: add my feature"
```

7. **Push to fork**
```bash
git push origin feature/my-feature
```

8. **Create pull request**

### Commit Convention

Follow conventional commits:

```
feat: add new feature
fix: fix bug
docs: update documentation
style: formatting changes
refactor: code refactoring
test: add tests
chore: maintenance tasks
```

### Pull Request Guidelines

- **Title**: Clear and descriptive
- **Description**: Explain changes and motivation
- **Tests**: Include tests for new functionality
- **Documentation**: Update relevant documentation
- **Breaking Changes**: Clearly document any breaking changes

### Code Review Process

1. **Automated checks**: CI/CD pipeline runs tests
2. **Manual review**: Maintainers review code
3. **Feedback**: Address review comments
4. **Approval**: Get approval from maintainers
5. **Merge**: Merge into main branch

---

## Performance Optimization

### Frontend Optimization

#### Code Splitting

```typescript
// Route-based splitting
const Editor = lazy(() => import('./routes/Editor'));
const Settings = lazy(() => import('./routes/Settings'));
```

#### Image Optimization

```typescript
// Use next/image or similar optimization
import Image from 'next/image';

<Image 
  src="/logo.png" 
  alt="Logo" 
  width={200} 
  height={100}
  loading="lazy"
/>
```

#### Bundle Analysis

```bash
# Analyze bundle size
npm run build
npm run analyze
```

### Backend Optimization

#### Caching

```typescript
// Implement caching for expensive operations
const cache = new Map();

async function getCachedData(key: string) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const data = await fetchData(key);
  cache.set(key, data);
  return data;
}
```

#### Database Optimization

```typescript
// Use connection pooling
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

---

## Security Best Practices

### Input Validation

```typescript
// Always validate user input
function validateInput(input: unknown): string {
  if (typeof input !== 'string') {
    throw new Error('Invalid input');
  }
  
  // Sanitize input
  return input.trim().slice(0, 1000);
}
```

### API Key Protection

```typescript
// Never expose API keys in client code
// Use environment variables
const apiKey = process.env.GEMINI_API_KEY;

// Proxy through server
app.get('/api/ai', async (req, res) => {
  const response = await fetchAI(apiKey, req.body);
  res.json(response);
});
```

### XSS Prevention

```typescript
// Use React's built-in XSS protection
const userContent = '<script>alert("xss")</script>';

// Good: React escapes by default
<div>{userContent}</div>

// Bad: Dangerous HTML injection
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

---

## Deployment

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .
EXPOSE 9876
CMD ["npm", "start"]
```

### Cloud Deployment

#### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

#### AWS

```bash
# Build and deploy to AWS
npm run build
aws s3 sync dist s3://my-bucket
```

---

*Last updated: June 2026*