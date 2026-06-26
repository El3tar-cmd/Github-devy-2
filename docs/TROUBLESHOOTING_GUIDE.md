# Troubleshooting Guide

Comprehensive troubleshooting guide for common issues and solutions.

## Table of Contents

1. [Getting Help](#getting-help)
2. [Common Issues](#common-issues)
3. [Debug Mode](#debug-mode)
4. [Log Analysis](#log-analysis)
5. [Performance Issues](#performance-issues)
6. [Network Issues](#network-issues)
7. [AI Integration Issues](#ai-integration-issues)
8. [File System Issues](#file-system-issues)
9. [Database Issues](#database-issues)
10. [Deployment Issues](#deployment-issues)

---

## Getting Help

### Resources

- **Documentation**: `/docs` and `DOCUMENTATION.md`
- **API Reference**: `API_REFERENCE.md`
- **Development Guide**: `DEVELOPMENT_GUIDE.md`
- **Deployment Guide**: `DEPLOYMENT_GUIDE.md`
- **GitHub Issues**: Report bugs and feature requests
- **Community**: Join our Discord server for community support

### Reporting Issues

When reporting issues, include:

1. **Environment Information**:
   - Operating system and version
   - Node.js version
   - Browser version (if applicable)
   - Github-devy version

2. **Steps to Reproduce**:
   - Detailed steps to reproduce the issue
   - Expected behavior
   - Actual behavior

3. **Error Messages**:
   - Full error messages and stack traces
   - Relevant log files

4. **Configuration**:
   - Environment variables (sanitized)
   - Configuration files

---

## Common Issues

### Installation Issues

#### Issue: npm install fails

**Symptoms**:
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solutions**:

1. **Clear npm cache**:
```bash
npm cache clean --force
```

2. **Use legacy peer deps**:
```bash
npm install --legacy-peer-deps
```

3. **Update npm**:
```bash
npm install -g npm@latest
```

4. **Delete node_modules and reinstall**:
```bash
rm -rf node_modules package-lock.json
npm install
```

#### Issue: TypeScript compilation errors

**Symptoms**:
```
error TS2307: Cannot find module 'xxx'
```

**Solutions**:

1. **Install missing types**:
```bash
npm install --save-dev @types/node @types/react @types/express
```

2. **Check tsconfig.json**:
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  }
}
```

3. **Restart TypeScript server** in your IDE

### Startup Issues

#### Issue: Server won't start

**Symptoms**:
```
Error: listen EADDRINUSE: address already in use :::9876
```

**Solutions**:

1. **Kill process using the port**:
```bash
# Find process
lsof -i :9876

# Kill process
kill -9 <PID>
```

2. **Use different port**:
```env
PORT=9877 npm run dev
```

3. **Check for zombie processes**:
```bash
ps aux | grep node
```

#### Issue: Workspace not loading

**Symptoms**:
- Workspace list is empty
- Cannot switch to workspace
- Files not appearing

**Solutions**:

1. **Check workspace directory**:
```bash
ls -la .agent_workspace/
```

2. **Verify permissions**:
```bash
chmod -R 755 .agent_workspace/
```

3. **Check workspace configuration**:
```bash
cat .agent_workspace/workspace-123/config.json
```

4. **Recreate workspace**:
```bash
rm -rf .agent_workspace/workspace-123
# Create new workspace through UI
```

---

## Debug Mode

### Enabling Debug Mode

Set environment variable:

```env
DEBUG=github-devy:*
```

Or run with debug flag:

```bash
DEBUG=github-devy:* npm run dev
```

### Debug Categories

```bash
# All debug logs
DEBUG=github-devy:*

# Specific categories
DEBUG=github-devy:workspace
DEBUG=github-devy:terminal
DEBUG=github-devy:ai
DEBUG=github-devy:api
```

### VS Code Debug Configuration

Create `.vscode/launch.json`:

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
      "skipFiles": ["<node_internals>/**"],
      "env": {
        "DEBUG": "github-devy:*"
      }
    },
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug Client",
      "url": "http://localhost:9876",
      "webRoot": "${workspaceFolder}"
    }
  ]
}
```

---

## Log Analysis

### Log Locations

```bash
# Application logs
/var/log/github-devy/app.log

# Error logs
/var/log/github-devy/error.log

# Terminal logs
.agent_workspace/[workspace-id]/terminal.log

# Access logs
/var/log/github-devy/access.log
```

### Viewing Logs

```bash
# Real-time logs
tail -f /var/log/github-devy/app.log

# Error logs only
tail -f /var/log/github-devy/error.log

# Last 100 lines
tail -n 100 /var/log/github-devy/app.log

# Search for errors
grep -i "error" /var/log/github-devy/app.log

# Search for specific workspace
grep "workspace-123" /var/log/github-devy/app.log
```

### Log Analysis Tools

#### Using jq for JSON logs

```bash
# Pretty print JSON logs
cat /var/log/github-devy/app.log | jq '.'

# Filter by level
cat /var/log/github-devy/app.log | jq 'select(.level == "error")'

# Extract specific fields
cat /var/log/github-devy/app.log | jq '.timestamp, .message, .workspaceId'
```

#### Using grep for text logs

```bash
# Count errors
grep -c "ERROR" /var/log/github-devy/app.log

# Find recent errors
grep "ERROR" /var/log/github-devy/app.log | tail -20

# Search by time range
sed -n '/2024-01-01 10:00/,/2024-01-01 11:00/p' /var/log/github-devy/app.log
```

---

## Performance Issues

### High CPU Usage

#### Symptoms

- Server CPU usage > 80%
- Slow response times
- Unresponsive interface

#### Solutions

1. **Identify CPU-intensive processes**:
```bash
top -p $(pgrep -d ',' node)
```

2. **Check for memory leaks**:
```bash
node --inspect server.ts
# Then use Chrome DevTools Memory profiler
```

3. **Optimize file watching**:
```env
DISABLE_HMR=true
```

4. **Reduce workspace size**:
```bash
# Clean up large workspaces
du -sh .agent_workspace/*
```

### High Memory Usage

#### Symptoms

- Node.js process using > 2GB memory
- Out of memory errors
- Frequent garbage collection

#### Solutions

1. **Increase Node.js memory limit**:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

2. **Check for memory leaks**:
```javascript
// Add memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory usage:', usage);
}, 60000);
```

3. **Clear caches**:
```bash
# Clear workspace cache
rm -rf .agent_workspace/*/cache
```

4. **Optimize database queries**:
```typescript
// Use pagination instead of loading all data
const results = await Model.find().limit(100).skip(offset);
```

### Slow Response Times

#### Symptoms

- API requests taking > 5 seconds
- Slow file operations
- Laggy terminal output

#### Solutions

1. **Enable response time logging**:
```typescript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${duration}ms`);
  });
  next();
});
```

2. **Optimize database queries**:
```typescript
// Add indexes
db.collection('files').createIndex({ workspaceId: 1, path: 1 });
```

3. **Enable caching**:
```typescript
const cache = new Map();
function getCachedData(key) {
  if (cache.has(key)) return cache.get(key);
  const data = fetchData(key);
  cache.set(key, data);
  return data;
}
```

4. **Use CDN for static assets**:
```nginx
location /static/ {
    proxy_pass http://app;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## Network Issues

### WebSocket Connection Failures

#### Symptoms

- Terminal not connecting
- "WebSocket connection failed" errors
- Fallback to HTTP mode

#### Solutions

1. **Check WebSocket support**:
```javascript
// Test WebSocket connection
const ws = new WebSocket('ws://localhost:9876/terminal');
ws.onopen = () => console.log('WebSocket connected');
ws.onerror = (error) => console.error('WebSocket error:', error);
```

2. **Check firewall settings**:
```bash
# Allow WebSocket connections
sudo ufw allow 9876/tcp
```

3. **Verify proxy settings**:
```nginx
# Ensure WebSocket upgrade is allowed
location /terminal {
    proxy_pass http://app;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

4. **Test HTTP fallback**:
```typescript
// Force HTTP mode
const useWebSocket = false;
```

### Port Conflicts

#### Symptoms

- "Address already in use" errors
- Cannot start server
- Services not accessible

#### Solutions**

1. **Find process using port**:
```bash
lsof -i :9876
netstat -tulpn | grep 9876
```

2. **Kill conflicting process**:
```bash
kill -9 <PID>
```

3. **Use different port**:
```env
PORT=9877
```

4. **Configure firewall**:
```bash
# Open specific port
sudo ufw allow 9876/tcp
```

### DNS Issues

#### Symptoms

- Cannot resolve hostnames
- API calls failing
- External services unreachable

#### Solutions

1. **Test DNS resolution**:
```bash
nslookup google.com
dig google.com
```

2. **Check DNS configuration**:
```bash
cat /etc/resolv.conf
```

3. **Use alternative DNS**:
```bash
# Use Google DNS
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```

4. **Flush DNS cache**:
```bash
# Linux
sudo systemd-resolve --flush-caches

# macOS
sudo dscacheutil -flushcache
```

---

## AI Integration Issues

### Gemini API Issues

#### Issue: API key errors

**Symptoms**:
```
Error: API key not valid
```

**Solutions**:

1. **Verify API key**:
```env
GEMINI_API_KEY=your_actual_api_key
```

2. **Check API key permissions**:
- Ensure API key has correct permissions
- Check API key is not expired

3. **Test API key**:
```bash
curl -H "x-goog-api-key: YOUR_API_KEY" \
  "https://generativelanguage.googleapis.com/v1beta/models"
```

#### Issue: Rate limiting

**Symptoms**:
```
Error: Quota exceeded
```

**Solutions**:

1. **Implement rate limiting**:
```typescript
const rateLimiter = new Map();
function checkRateLimit(apiKey: string): boolean {
  const now = Date.now();
  const requests = rateLimiter.get(apiKey) || [];
  const recentRequests = requests.filter(time => now - time < 60000);
  
  if (recentRequests.length >= 100) {
    return false; // Rate limit exceeded
  }
  
  recentRequests.push(now);
  rateLimiter.set(apiKey, recentRequests);
  return true;
}
```

2. **Use exponential backoff**:
```typescript
async function callWithRetry(fn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

### Ollama Integration Issues

#### Issue: Cannot connect to Ollama

**Symptoms**:
```
Error: connect ECONNREFUSED localhost:11434
```

**Solutions**:

1. **Check Ollama is running**:
```bash
ollama list
```

2. **Start Ollama**:
```bash
ollama serve
```

3. **Check Ollama URL**:
```env
OLLAMA_URL=http://localhost:11434
```

4. **Test Ollama connection**:
```bash
curl http://localhost:11434/api/tags
```

#### Issue: Model not found

**Symptoms**:
```
Error: model 'llama3' not found
```

**Solutions**:

1. **Pull model**:
```bash
ollama pull llama3
```

2. **List available models**:
```bash
ollama list
```

3. **Update model configuration**:
```env
OLLAMA_MODEL=llama3
```

---

## File System Issues

### Permission Errors

#### Symptoms

```
Error: EACCES: permission denied
```

**Solutions**:

1. **Check permissions**:
```bash
ls -la .agent_workspace/
```

2. **Fix permissions**:
```bash
chmod -R 755 .agent_workspace/
chown -R $USER:$USER .agent_workspace/
```

3. **Run with correct user**:
```bash
# Don't run as root
sudo -u $USER npm start
```

### Disk Space Issues

#### Symptoms

```
Error: ENOSPC: no space left on device
```

**Solutions**:

1. **Check disk space**:
```bash
df -h
```

2. **Clean up old workspaces**:
```bash
# Remove workspaces older than 30 days
find .agent_workspace/ -type d -mtime +30 -exec rm -rf {} \;
```

3. **Clean up node_modules**:
```bash
# Remove unused node_modules
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
```

4. **Clean up logs**:
```bash
# Rotate and compress old logs
logrotate -f /etc/logrotate.d/github-devy
```

### File Lock Issues

#### Symptoms

```
Error: EBUSY: resource busy or locked
```

**Solutions**:

1. **Find locked files**:
```bash
lsof +D .agent_workspace/
```

2. **Kill processes holding locks**:
```bash
fuser -k .agent_workspace/workspace-123/file.ts
```

3. **Wait for file operations to complete**:
```typescript
// Implement file operation queue
const fileQueue = new Map();
async function withFileLock(filePath: string, operation: () => Promise<any>) {
  while (fileQueue.has(filePath)) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  fileQueue.set(filePath, true);
  try {
    return await operation();
  } finally {
    fileQueue.delete(filePath);
  }
}
```

---

## Database Issues

### Connection Issues

#### Symptoms

```
Error: connect ECONNREFUSED
```

**Solutions**:

1. **Check database is running**:
```bash
# PostgreSQL
pg_isready

# MySQL
mysqladmin ping
```

2. **Check connection string**:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/github_devy
```

3. **Test connection**:
```bash
psql -U user -d github_devy
```

### Query Performance Issues

#### Symptoms

- Slow queries
- Database timeouts
- High database CPU usage

**Solutions**:

1. **Analyze slow queries**:
```sql
-- PostgreSQL
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

2. **Add indexes**:
```sql
CREATE INDEX idx_workspace_files ON files(workspace_id, path);
CREATE INDEX idx_files_created ON files(created_at);
```

3. **Optimize queries**:
```typescript
// Bad: Loading all data
const allFiles = await File.find();

// Good: Using pagination and filtering
const files = await File.find({ workspaceId })
  .limit(100)
  .skip(offset)
  .sort({ createdAt: -1 });
```

4. **Use connection pooling**:
```typescript
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Migration Issues

#### Symptoms

- Schema mismatch errors
- Migration failures
- Data corruption

**Solutions**:

1. **Check migration status**:
```bash
npm run migrate:status
```

2. **Rollback migration**:
```bash
npm run migrate:rollback
```

3. **Recreate database**:
```bash
# Backup first
pg_dump github_devy > backup.sql

# Drop and recreate
dropdb github_devy
createdb github_devy
npm run migrate

# Restore if needed
psql github_devy < backup.sql
```

---

## Deployment Issues

### Docker Issues

#### Issue: Container won't start

**Symptoms**:
```
Error: Container exited with code 1
```

**Solutions**:

1. **Check container logs**:
```bash
docker logs github-devy
```

2. **Check container status**:
```bash
docker ps -a
docker inspect github-devy
```

3. **Enter container for debugging**:
```bash
docker exec -it github-devy sh
```

4. **Rebuild image**:
```bash
docker-compose build --no-cache
docker-compose up -d
```

#### Issue: Volume mounting issues

**Symptoms**:
- Files not persisting
- Permission errors
- Empty volumes

**Solutions**:

1. **Check volume mounts**:
```bash
docker inspect github-devy | grep -A 10 Mounts
```

2. **Fix permissions**:
```bash
# On host
sudo chown -R 1000:1000 .agent_workspace/

# In container
chown -R nodejs:nodejs /var/lib/github-devy/workspaces
```

3. **Recreate volumes**:
```bash
docker-compose down -v
docker-compose up -d
```

### Kubernetes Issues

#### Issue: Pod not starting

**Symptoms**:
- Pod stuck in Pending state
- CrashLoopBackOff

**Solutions**:

1. **Check pod status**:
```bash
kubectl get pods
kubectl describe pod github-devy-xxx
```

2. **Check pod logs**:
```bash
kubectl logs github-devy-xxx
kubectl logs github-devy-xxx --previous
```

3. **Check events**:
```bash
kubectl get events --sort-by=.metadata.creationTimestamp
```

4. **Check resource limits**:
```bash
kubectl describe pod github-devy-xxx | grep -A 5 Limits
```

#### Issue: Service not accessible

**Symptoms**:
- Cannot connect to service
- Connection refused

**Solutions**:

1. **Check service status**:
```bash
kubectl get services
kubectl describe service github-devy
```

2. **Check endpoints**:
```bash
kubectl get endpoints github-devy
```

3. **Test service internally**:
```bash
kubectl run -it --rm debug --image=curlimages/curl -- curl http://github-devy
```

4. **Check ingress**:
```bash
kubectl get ingress
kubectl describe ingress github-devy-ingress
```

---

## Additional Resources

### System Monitoring

```bash
# System resources
htop
iostat -x 1
vmstat 1

# Network monitoring
netstat -tulpn
tcpdump -i any port 9876

# File system monitoring
inotifywait -m -r .agent_workspace/
```

### Performance Profiling

```bash
# Node.js profiling
node --prof server.ts
node --prof-process isolate-0x*.log > profile.txt

# Memory profiling
node --heap-prof server.ts
```

### Health Checks

```bash
# Application health
curl http://localhost:9876/health

# Database health
pg_isready -h localhost -p 5432

# Redis health
redis-cli ping
```

---

*Last updated: June 2026*