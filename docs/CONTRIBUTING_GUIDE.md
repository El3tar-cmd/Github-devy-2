# Contributing Guide

Thank you for your interest in contributing to Github-devy! This guide will help you get started with contributing to the project.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Coding Standards](#coding-standards)
4. [Testing Guidelines](#testing-guidelines)
5. [Documentation](#documentation)
6. [Pull Request Process](#pull-request-process)
7. [Code Review](#code-review)
8. [Community Guidelines](#community-guidelines)

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js** v18 or higher
- **npm** v9 or higher
- **Git** installed and configured
- **GitHub account**
- **Code editor** (VS Code recommended)

### Initial Setup

1. **Fork the repository**:
   - Go to https://github.com/yourusername/github-devy
   - Click the "Fork" button

2. **Clone your fork**:
```bash
git clone https://github.com/yourusername/github-devy.git
cd github-devy
```

3. **Add upstream remote**:
```bash
git remote add upstream https://github.com/original-owner/github-devy.git
```

4. **Install dependencies**:
```bash
npm install
```

5. **Set up environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

6. **Start development server**:
```bash
npm run dev
```

---

## Development Workflow

### Branch Strategy

We use a simplified Git flow:

- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/***: Feature branches
- **bugfix/***: Bug fix branches
- **hotfix/***: Urgent production fixes

### Creating a Feature Branch

1. **Ensure your main is up to date**:
```bash
git checkout main
git pull upstream main
```

2. **Create feature branch**:
```bash
git checkout -b feature/your-feature-name
```

3. **Make your changes**:
```bash
# Edit files
git add .
git commit -m "feat: add your feature"
```

4. **Push to your fork**:
```bash
git push origin feature/your-feature-name
```

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Commit Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **ci**: CI/CD changes
- **build**: Build system changes

#### Examples

```bash
# Good commits
git commit -m "feat: add dark mode support"
git commit -m "fix: resolve terminal connection timeout"
git commit -m "docs: update API reference"
git commit -m "refactor: simplify file tree component"
git commit -m "test: add unit tests for workspace manager"

# Bad commits
git commit -m "update stuff"
git commit -m "fixed bug"
git commit -m "wip"
```

### Keeping Your Branch Updated

Regularly sync with upstream:

```bash
# Fetch upstream changes
git fetch upstream

# Rebase your branch on upstream/main
git rebase upstream/main

# Resolve conflicts if any
# Continue rebase
git rebase --continue

# Force push to your fork
git push origin feature/your-feature-name --force-with-lease
```

---

## Coding Standards

### TypeScript Guidelines

#### Type Safety

Always use TypeScript's type system:

```typescript
// Good: Explicit types
interface User {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): User {
  return { id, name: 'John', email: 'john@example.com' };
}

// Bad: Using any
function getUser(id: any): any {
  return { id, name: 'John', email: 'john@example.com' };
}
```

#### Interface vs Type

Use interfaces for object shapes, types for unions:

```typescript
// Good: Interface for objects
interface ComponentProps {
  title: string;
  onAction: () => void;
}

// Good: Type for unions
type Status = 'loading' | 'success' | 'error';
type Theme = 'light' | 'dark';
type Config = Status & Theme;
```

#### Generic Types

Use generics for reusable components:

```typescript
// Good: Generic component
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
// Good: Clear component structure
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  // 1. Hooks
  const [state, setState] = useState<string>('');
  const { data, loading } = useData();
  
  // 2. Derived values
  const isValid = useMemo(() => state.length > 0, [state]);
  
  // 3. Effects
  useEffect(() => {
    document.title = title;
  }, [title]);
  
  // 4. Handlers
  const handleClick = useCallback(() => {
    if (isValid) {
      onAction();
    }
  }, [isValid, onAction]);
  
  // 5. Render
  return (
    <div>
      <h1>{title}</h1>
      <button onClick={handleClick} disabled={!isValid}>
        Action
      </button>
    </div>
  );
}
```

#### Custom Hooks

Extract reusable logic into custom hooks:

```typescript
// Good: Custom hook
function useWorkspace(workspaceId: string) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let cancelled = false;
    
    async function loadWorkspace() {
      try {
        const data = await fetchWorkspace(workspaceId);
        if (!cancelled) {
          setWorkspace(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    
    loadWorkspace();
    
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);
  
  return { workspace, loading, error };
}
```

#### Performance Optimization

```typescript
// Good: Memoization
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

const handleClick = useCallback(() => {
  doSomething(dependency);
}, [dependency]);

const ExpensiveComponent = memo(function ExpensiveComponent({ data }: Props) {
  return <div>{/* expensive rendering */}</div>;
});
```

### CSS/Tailwind Guidelines

#### Utility-First Approach

```typescript
// Good: Tailwind utilities
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

## Testing Guidelines

### Unit Testing

Write unit tests for individual functions and components:

```typescript
// MyComponent.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
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
    expect(onAction).toHaveBeenCalledTimes(1);
  });
  
  it('disables button when invalid', () => {
    const onAction = jest.fn();
    render(<MyComponent title="Test" onAction={onAction} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
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
    expect(result.current.workspaces[0].name).toBe('test-workspace');
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
  
  // Navigate to workspace creation
  await page.click('[data-testid="create-workspace"]');
  
  // Fill form
  await page.fill('[data-testid="workspace-name"]', 'test-workspace');
  
  // Submit
  await page.click('[data-testid="submit"]');
  
  // Verify workspace created
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

# Run tests with coverage
npm test -- --coverage

# Run E2E tests
npm run test:e2e

# Run linting
npm run lint

# Type checking
npm run type-check
```

### Test Coverage

Maintain high test coverage:

- **Unit tests**: > 80% coverage
- **Integration tests**: Key user flows
- **E2E tests**: Critical paths

```bash
# Generate coverage report
npm test -- --coverage

# View coverage report
open coverage/lcov-report/index.html
```

---

## Documentation

### Code Documentation

Document complex functions and components:

```typescript
/**
 * Creates a new workspace with the specified configuration.
 * 
 * @param name - The name of the workspace
 * @param options - Optional workspace configuration
 * @param options.template - Template to use for workspace
 * @param options.gitIntegration - Enable Git integration
 * @returns Promise resolving to the created workspace
 * @throws {Error} If workspace creation fails
 * 
 * @example
 * ```typescript
 * const workspace = await createWorkspace('my-project', {
 *   template: 'react-typescript',
 *   gitIntegration: true
 * });
 * ```
 */
export async function createWorkspace(
  name: string,
  options?: WorkspaceOptions
): Promise<Workspace> {
  // Implementation
}
```

### Component Documentation

Document component props and usage:

```typescript
/**
 * MyComponent - A component that does something useful.
 * 
 * @example
 * ```tsx
 * <MyComponent 
 *   title="Hello World"
 *   onAction={() => console.log('clicked')}
 * />
 * ```
 */
export interface MyComponentProps {
  /** The title to display */
  title: string;
  /** Callback when action is triggered */
  onAction: () => void;
  /** Optional description text */
  description?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
}
```

### README Updates

Update relevant documentation when making changes:

- **New features**: Update README.md
- **API changes**: Update API_REFERENCE.md
- **Breaking changes**: Update migration guide
- **Bug fixes**: Update TROUBLESHOOTING_GUIDE.md

### Documentation Standards

- **Clear and concise**: Use simple language
- **Examples**: Include code examples
- **Screenshots**: Add screenshots for UI changes
- **Links**: Cross-reference related documentation

---

## Pull Request Process

### Before Submitting

1. **Run tests**:
```bash
npm test
npm run lint
npm run type-check
```

2. **Format code**:
```bash
npm run format
```

3. **Build project**:
```bash
npm run build
```

4. **Update documentation**:
   - Update README.md if needed
   - Add/update API documentation
   - Update CHANGELOG.md

### Creating Pull Request

1. **Go to your fork on GitHub**
2. **Click "New Pull Request"**
3. **Select your branch**
4. **Fill PR template**:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] All tests passing

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No merge conflicts
- [ ] Commit messages follow convention

## Related Issues
Closes #123
Related to #456
```

### PR Best Practices

- **Small, focused PRs**: Keep changes focused and manageable
- **Clear descriptions**: Explain what and why
- **Testing evidence**: Show test results
- **Screenshots**: Include before/after for UI changes
- **Breaking changes**: Clearly document migration path

---

## Code Review

### Review Process

1. **Automated Checks**:
   - CI/CD pipeline runs tests
   - Linting checks pass
   - Build succeeds

2. **Peer Review**:
   - At least one maintainer review
   - Address all review comments
   - Make requested changes

3. **Approval**:
   - Get approval from maintainers
   - Resolve all conversations
   - Ensure CI passes

### Review Guidelines

#### For Reviewers

- **Be constructive**: Provide helpful feedback
- **Be specific**: Point to exact issues
- **Explain why**: Help author understand
- **Be timely**: Review promptly

#### For Authors

- **Respond to all comments**: Address each point
- **Ask questions**: Clarify if needed
- **Be open**: Consider suggestions
- **Update PR**: Make necessary changes

### Common Review Feedback

#### Code Quality

- **Type safety**: Add proper types
- **Error handling**: Add try-catch blocks
- **Performance**: Optimize expensive operations
- **Readability**: Improve code structure

#### Testing

- **Coverage**: Add missing tests
- **Edge cases**: Test error conditions
- **Integration**: Test component interactions

#### Documentation

- **Comments**: Add inline comments
- **README**: Update user documentation
- **API docs**: Update API reference

---

## Community Guidelines

### Code of Conduct

- **Be respectful**: Treat everyone with respect
- **Be inclusive**: Welcome all contributors
- **Be collaborative**: Work together effectively
- **Be constructive**: Provide helpful feedback

### Communication

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and ideas
- **Discord**: For real-time chat
- **Email**: For security issues

### Getting Help

- **Read documentation**: Check existing docs first
- **Search issues**: Look for similar problems
- **Ask questions**: Use GitHub Discussions
- **Join community**: Connect with other contributors

### Recognition

Contributors are recognized for their contributions:

- **Contributors list**: Displayed in README
- **Release notes**: Mentioned in changelog
- **Badges**: Earn contributor badges
- **Swag**: Receive contributor swag

---

## Development Tools

### Recommended VS Code Extensions

- **ESLint**: Linting support
- **Prettier**: Code formatting
- **TypeScript Importer**: Auto import
- **Tailwind CSS IntelliSense**: Tailwind support
- **GitLens**: Git integration
- **Testing**: Test explorer

### Git Hooks

Install git hooks for pre-commit checks:

```bash
# Install husky
npm install --save-dev husky

# Set up hooks
npx husky install
npx husky add .husky/pre-commit "npm test"
npx husky add .husky/commit-msg "npx commitlint --edit $1"
```

### Commitlint

Configure commitlint for commit message validation:

```json
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore']
    ],
    'subject-case': [0]
  }
};
```

---

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped
- [ ] Git tag created
- [ ] Release published

### Creating Release

```bash
# Bump version
npm version patch/minor/major

# Update changelog
# Edit CHANGELOG.md

# Commit changes
git add .
git commit -m "chore: release v1.2.3"

# Create tag
git tag v1.2.3

# Push to GitHub
git push origin main
git push origin v1.2.3

# Create release on GitHub
# Go to GitHub Releases and create release
```

---

## Resources

### Documentation

- [Main Documentation](DOCUMENTATION.md)
- [API Reference](API_REFERENCE.md)
- [Development Guide](DEVELOPMENT_GUIDE.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)

### External Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Node.js Documentation](https://nodejs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## License

By contributing to Github-devy, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Github-devy! Your contributions help make this project better for everyone.

*Last updated: June 2026*