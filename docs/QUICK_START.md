# Quick Start Guide

Get started with Github-devy in minutes! This guide will help you set up and run your first AI-powered development workspace.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** v18 or higher installed
- **npm** v9 or higher installed
- **Git** installed and configured
- A modern web browser (Chrome, Firefox, Safari, or Edge)
- At least 4GB of available RAM
- 2GB of free disk space

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/github-devy.git
cd github-devy
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required dependencies including React, TypeScript, Express, and other development tools.

### Step 3: Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# AI Configuration (optional but recommended)
GEMINI_API_KEY=your_gemini_api_key_here
OLLAMA_URL=http://localhost:11434

# Server Configuration
PORT=9876
NODE_ENV=development

# GitHub Integration (optional)
GITHUB_TOKEN=your_github_token_here
```

### Step 4: Start the Development Server

```bash
npm run dev
```

The server will start on `http://localhost:9876`

## First Steps

### 1. Create Your First Workspace

1. Open your browser and navigate to `http://localhost:9876`
2. Click on "Create New Workspace"
3. Enter a name for your workspace (e.g., "my-first-project")
4. Choose a template (optional):
   - **Blank**: Start from scratch
   - **React TypeScript**: React + TypeScript setup
   - **Node.js**: Node.js backend project
   - **Full Stack**: Complete full-stack template
5. Click "Create Workspace"

### 2. Explore the Interface

#### Left Sidebar
- **File Explorer**: Browse and manage your project files
- **Terminal**: Execute commands in your workspace
- **Git**: Manage version control
- **Packages**: Manage npm packages
- **Database**: Manage SQLite databases

#### Main Area
- **Editor**: Monaco code editor with syntax highlighting
- **Browser Preview**: Live preview of your web applications
- **Chat**: AI-powered development assistant

#### Right Panel
- **AI Chat**: Interact with AI assistants
- **Settings**: Configure your preferences
- **Planner**: AI project planning

### 3. Create Your First File

1. Navigate to the File Explorer
2. Right-click and select "New File"
3. Name the file `index.html`
4. Add the following content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My First App</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        h1 {
            color: white;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
    </style>
</head>
<body>
    <h1>Hello, Github-devy!</h1>
</body>
</html>
```

5. Save the file (Ctrl+S or Cmd+S)

### 4. Preview Your Application

1. Click on the "Browser Preview" tab
2. The preview will automatically load your `index.html`
3. You should see "Hello, Github-devy!" displayed

### 5. Use the AI Assistant

1. Click on the "Chat" tab
2. Type a message to the AI assistant:
   ```
   Can you help me add a button to my HTML page?
   ```
3. The AI will provide code suggestions and can even modify files for you
4. Review the suggested changes and apply them

## Common Tasks

### Running a Development Server

1. Open the Terminal tab
2. Navigate to your project directory:
   ```bash
   cd your-project
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open the Browser Preview to see your application

### Using Git

1. Click on the "Git" tab
2. Initialize a repository:
   ```bash
   git init
   ```
3. Add files:
   ```bash
   git add .
   ```
4. Commit changes:
   ```bash
   git commit -m "Initial commit"
   ```
5. Push to GitHub (configure remote first):
   ```bash
   git remote add origin https://github.com/yourusername/your-repo.git
   git push -u origin main
   ```

### Installing Packages

1. Click on the "Packages" tab
2. Search for a package (e.g., "lodash")
3. Click "Install" to add it to your project
4. Or use the terminal:
   ```bash
   npm install lodash
   ```

### Managing Databases

1. Click on the "Database" tab
2. Create a new database or connect to an existing one
3. Use the query editor to run SQL commands
4. Browse and edit table data

## AI Integration Setup

### Google Gemini API

1. Get your API key from [Google AI Studio](https://ai.google.dev)
2. Add it to your `.env` file:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
3. Restart the server
4. Select "Gemini" as your AI provider in Settings

### Ollama (Local AI)

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Start Ollama:
   ```bash
   ollama serve
   ```
3. Pull a model:
   ```bash
   ollama pull llama3
   ```
4. Configure in Settings:
   - Ollama URL: `http://localhost:11434`
   - Model: `llama3`

## Keyboard Shortcuts

### Editor
- `Ctrl/Cmd + S`: Save file
- `Ctrl/Cmd + F`: Find in file
- `Ctrl/Cmd + H`: Replace in file
- `Ctrl/Cmd + /`: Toggle comment
- `Ctrl/Cmd + D`: Select word

### Terminal
- `Ctrl/Cmd + C`: Copy
- `Ctrl/Cmd + V`: Paste
- `Ctrl/Cmd + L`: Clear terminal
- `Ctrl/Cmd + K`: Clear line

### Navigation
- `Ctrl/Cmd + P`: Quick file open
- `Ctrl/Cmd + B`: Toggle sidebar
- `Ctrl/Cmd + \` : Toggle terminal

## Tips and Tricks

### 1. Use AI for Code Generation

Ask the AI to generate code for you:
```
Create a React component for a user profile card with avatar, name, and email
```

### 2. Debug with AI

If you encounter errors, share them with the AI:
```
I'm getting this error: [paste error]. Can you help me fix it?
```

### 3. Get Code Reviews

Ask the AI to review your code:
```
Can you review this code and suggest improvements? [paste code]
```

### 4. Learn New Technologies

Ask the AI to explain concepts:
```
Can you explain how React hooks work with examples?
```

### 5. Generate Documentation

Ask the AI to document your code:
```
Can you add JSDoc comments to this function? [paste code]
```

## Troubleshooting

### Server Won't Start

**Problem**: Port 9876 is already in use

**Solution**:
```bash
# Find process using the port
lsof -i :9876

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=9877 npm run dev
```

### AI Not Responding

**Problem**: AI assistant not generating responses

**Solution**:
1. Check your API key is correct
2. Verify you have internet connection (for Gemini)
3. Ensure Ollama is running (for local models)
4. Check the browser console for errors

### Files Not Saving

**Problem**: Changes not persisting

**Solution**:
1. Check file permissions
2. Ensure workspace has write access
3. Check disk space availability
4. Try refreshing the page

### Terminal Not Working

**Problem**: Terminal commands not executing

**Solution**:
1. Check WebSocket connection
2. Try HTTP fallback mode
3. Verify workspace permissions
4. Check browser console for errors

## Next Steps

### Learn More

- Read the [Main Documentation](docs/DOCUMENTATION.md)
- Explore the [API Reference](docs/API_REFERENCE.md)
- Check out the [Development Guide](docs/DEVELOPMENT_GUIDE.md)

### Advanced Features

- **AI Builder**: Generate UI components from natural language
- **Project Planner**: AI-powered project planning
- **Custom Tools**: Create your own AI tools
- **Plugins**: Extend functionality with plugins

### Community

- Join our [Discord Server](https://discord.gg/github-devy)
- Follow us on [Twitter](https://twitter.com/githubdevy)
- Star us on [GitHub](https://github.com/yourusername/github-devy)

## Support

If you need help:

1. **Check Documentation**: Browse our comprehensive docs
2. **Search Issues**: Look for similar problems in GitHub Issues
3. **Ask Community**: Join our Discord server
4. **Contact Support**: email support@github-devy.com

## Examples

### Example 1: Create a React App

```bash
# In terminal
npm create vite@latest my-react-app -- --template react-ts
cd my-react-app
npm install
npm run dev
```

Then open the Browser Preview to see your React app.

### Example 2: Build a Node.js API

```bash
# Create package.json
npm init -y

# Install Express
npm install express

# Create index.js with Express server
# Then run: node index.js
```

### Example 3: Use AI to Generate Code

Ask the AI:
```
Create a REST API with Express that has endpoints for:
- GET /api/users - Get all users
- GET /api/users/:id - Get user by ID
- POST /api/users - Create new user
- PUT /api/users/:id - Update user
- DELETE /api/users/:id - Delete user
```

The AI will generate the complete code for you!

---

## Conclusion

You're now ready to use Github-devy! Explore the features, experiment with AI assistance, and build amazing projects.

For more detailed information, check out our comprehensive documentation in the `/docs` directory.

Happy coding! 🚀

---

*Last updated: June 2026*