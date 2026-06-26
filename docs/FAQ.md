# Frequently Asked Questions (FAQ)

Common questions and answers about Github-devy.

## Table of Contents

1. [General Questions](#general-questions)
2. [Installation & Setup](#installation--setup)
3. [Features & Usage](#features--usage)
4. [AI Integration](#ai-integration)
5. [Technical Questions](#technical-questions)
6. [Troubleshooting](#troubleshooting)
7. [Security & Privacy](#security--privacy)
8. [Licensing & Commercial Use](#licensing--commercial-use)

---

## General Questions

### What is Github-devy?

Github-devy is an advanced AI-powered cloud development environment that combines traditional IDE features with cutting-edge AI capabilities. It provides a complete development workspace with file management, terminal access, code editing, and AI assistance.

### What makes Github-devy different from other IDEs?

Github-devy offers several unique features:
- **AI-Powered Development**: Built-in AI assistance with multiple model support
- **Cloud-Based**: Access your workspace from anywhere
- **Sandboxed Workspaces**: Isolated development environments
- **Multi-Agent System**: Advanced AI agents for autonomous development
- **Browser Preview**: Live preview of web applications
- **Dual-Fallback Terminal**: Reliable terminal with WebSocket and HTTP fallback

### Is Github-devy free to use?

Yes, Github-devy is open-source and free to use. However, some AI features may require API keys (like Google Gemini API) or local model installation (Ollama).

### What are the system requirements?

- **OS**: Linux, macOS, or Windows (with WSL)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB minimum for installation
- **Node.js**: v18 or higher
- **Browser**: Modern browser with JavaScript enabled

---

## Installation & Setup

### How do I install Github-devy?

```bash
# Clone the repository
git clone https://github.com/yourusername/github-devy.git
cd github-devy

# Install dependencies
npm install

# Start development server
npm run dev
```

For detailed instructions, see the [Quick Start Guide](QUICK_START.md).

### Can I run Github-devy on Windows?

Yes, Github-devy works on Windows, but we recommend using Windows Subsystem for Linux (WSL) for the best experience. Some terminal features may have limitations on native Windows.

### How do I update Github-devy?

```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm install

# Restart server
npm run dev
```

### How do I uninstall Github-devy?

```bash
# Stop the server
# Remove the directory
rm -rf github-devy

# Remove workspaces (optional)
rm -rf .agent_workspace
```

---

## Features & Usage

### How do I create a new workspace?

1. Click on "Create New Workspace" in the sidebar
2. Enter a name for your workspace
3. Choose a template (optional)
4. Click "Create"

### Can I import existing projects?

Yes! You can import projects from:
- Git repositories
- ZIP archives
- Local directories

### How do I use the AI assistant?

1. Click on the "Chat" tab
2. Type your question or request
3. The AI will respond with suggestions or code
4. You can ask the AI to modify files, explain code, or generate new code

### What programming languages are supported?

Github-devy supports all programming languages that can be run in a Node.js environment, including:
- JavaScript/TypeScript
- Python (with proper setup)
- Go, Rust, C++ (with compilers)
- And many more

### Can I use my own code editor?

While Github-devy includes a built-in Monaco editor (VS Code's editor), you can also use external editors. The workspace files are accessible on your local file system.

### How does the browser preview work?

The browser preview uses an iframe with a Service Worker proxy to handle requests. This allows you to preview web applications running in your workspace with proper asset loading.

---

## AI Integration

### What AI models are supported?

Github-devy supports:
- **Google Gemini**: Cloud-based AI models (gemini-2.5-flash, gemini-2.5-pro, etc.)
- **Ollama**: Local models (llama3, mistral, codegemma, etc.)

### Do I need an API key?

For Google Gemini, yes. You can get a free API key from [Google AI Studio](https://ai.google.dev). For Ollama, you need to install and run Ollama locally.

### How do I set up Ollama?

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama
ollama serve

# Pull a model
ollama pull llama3

# Configure in Github-devy settings
# Ollama URL: http://localhost:11434
# Model: llama3
```

### Can I use custom AI models?

Yes! You can integrate custom AI models by:
1. Creating a custom API integration
2. Using the Ollama integration with custom models
3. Implementing your own AI provider

### How does the AI agent work?

The AI agent uses a tool-calling system to perform actions:
- Read and write files
- Execute terminal commands
- Browse the web
- Manage Git operations
- And more

The agent autonomously decides which tools to use based on your requests.

---

## Technical Questions

### What port does Github-devy use?

By default, Github-devy uses port 9876. You can change this in the `.env` file:

```env
PORT=3000
```

### How are workspaces isolated?

Each workspace is isolated in its own directory under `.agent_workspace/`. Workspaces have:
- Separate file systems
- Isolated node_modules
- Independent terminal sessions
- Separate AI contexts

### Can I run multiple instances?

Yes, you can run multiple instances on different ports:

```bash
PORT=9876 npm start &
PORT=9877 npm start &
```

### How do I configure HTTPS?

For production deployment, use a reverse proxy like nginx:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:9876;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

### Does Github-devy support Docker?

Yes! See the [Deployment Guide](DEPLOYMENT_GUIDE.md) for Docker setup instructions.

---

## Troubleshooting

### The server won't start

**Problem**: Port already in use

**Solution**:
```bash
# Find process using the port
lsof -i :9876

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=9877 npm run dev
```

### AI assistant not responding

**Problem**: API key issues or network problems

**Solution**:
1. Verify your API key is correct
2. Check your internet connection
3. Ensure Ollama is running (for local models)
4. Check browser console for errors

### Files not saving

**Problem**: Permission issues or disk space

**Solution**:
1. Check file permissions: `ls -la .agent_workspace/`
2. Verify disk space: `df -h`
3. Check write permissions: `chmod -R 755 .agent_workspace/`

### Terminal not working

**Problem**: WebSocket connection issues

**Solution**:
1. Check WebSocket support in your browser
2. Try HTTP fallback mode
3. Verify workspace permissions
4. Check browser console for errors

### Performance issues

**Problem**: Slow response times or high memory usage

**Solution**:
1. Close unused workspaces
2. Clear browser cache
3. Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=4096"`
4. Check for memory leaks in custom code

For more troubleshooting help, see the [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md).

---

## Security & Privacy

### Is my code secure?

Yes, your code is stored locally in the `.agent_workspace/` directory. We don't store your code on external servers unless you explicitly configure cloud storage.

### What data is sent to AI services?

When using AI services:
- **Google Gemini**: Your prompts and code context are sent to Google's servers
- **Ollama**: All processing happens locally on your machine

We recommend reviewing the privacy policies of AI service providers.

### Can I use Github-devy offline?

Yes! With Ollama for AI and local development tools, you can use Github-devy completely offline.

### How do I secure my installation?

1. Use strong API keys
2. Enable HTTPS in production
3. Implement rate limiting
4. Use firewall rules
5. Keep dependencies updated
6. Regular security audits

See the [Deployment Guide](DEPLOYMENT_GUIDE.md) for security best practices.

---

## Licensing & Commercial Use

### What license does Github-devy use?

Github-devy is licensed under the MIT License. You can use it for personal and commercial projects.

### Can I use Github-devy in my company?

Yes! The MIT License allows commercial use. However, please:
- Keep the license notice
- Attribute the original project
- Understand that the software is provided "as is"

### Can I modify and distribute Github-devy?

Yes, you can:
- Modify the code
- Distribute your modifications
- Use it in proprietary software
- Sell it as part of your product

Just keep the original license and attribution.

### Do I need to pay for Github-devy?

No, Github-devy is free and open-source. However:
- AI API calls may incur costs (Google Gemini)
- You may need to pay for hosting/cloud services
- Commercial support may be available (contact us)

---

## Advanced Questions

### Can I create custom tools for the AI?

Yes! You can create custom tools by implementing the Tool interface:

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any) => Promise<any>;
}
```

See the [Development Guide](DEVELOPMENT_GUIDE.md) for details.

### How do I extend Github-devy with plugins?

Github-devy supports a plugin system. You can create plugins to:
- Add new AI providers
- Extend file system operations
- Add custom UI components
- Integrate external services

### Can I integrate Github-devy with other tools?

Yes! Github-devy can be integrated with:
- CI/CD pipelines
- External editors (VS Code, etc.)
- Version control systems
- Project management tools
- Monitoring and logging systems

### How do I contribute to Github-devy?

We welcome contributions! See the [Contributing Guide](CONTRIBUTING_GUIDE.md) for details.

---

## Getting Help

### Where can I find more information?

- **Documentation**: Check the `/docs` directory
- **API Reference**: [API_REFERENCE.md](API_REFERENCE.md)
- **Troubleshooting**: [TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md)

### How do I report bugs?

Report bugs on our [GitHub Issues](https://github.com/yourusername/github-devy/issues) page. Please include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details

### How do I request features?

Request features on [GitHub Issues](https://github.com/yourusername/github-devy/issues) with the "enhancement" label.

### Where can I get community support?

- **Discord**: Join our community server
- **GitHub Discussions**: Ask questions and share ideas
- **Stack Overflow**: Tag questions with `github-devy`

---

## Additional Resources

### Learning Resources

- [Quick Start Guide](QUICK_START.md)
- [Development Guide](DEVELOPMENT_GUIDE.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Migration Guide](MIGRATION_GUIDE.md)

### External Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Node.js Documentation](https://nodejs.org/docs)
- [Google AI Studio](https://ai.google.dev)
- [Ollama Documentation](https://ollama.ai/docs)

---

## Contact

### Support

- **Email**: support@github-devy.com
- **Documentation**: docs@github-devy.com
- **Security**: security@github-devy.com

### Business Inquiries

- **Email**: business@github-devy.com
- **Partnerships**: partners@github-devy.com

---

*Last updated: June 2026*

For the most up-to-date information, check our documentation in the `/docs` directory.