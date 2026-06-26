# Migration Guide

Guide for migrating between versions of Github-devy.

## Table of Contents

1. [Version 1.0.0 Migration](#version-100-migration)
2. [Breaking Changes](#breaking-changes)
3. [Configuration Changes](#configuration-changes)
4. [API Changes](#api-changes)
5. [Data Migration](#data-migration)
6. [Rollback Procedure](#rollback-procedure)

---

## Version 1.0.0 Migration

### Overview

Version 1.0.0 introduces several breaking changes and improvements. This guide will help you migrate from previous versions.

### Pre-Migration Checklist

- [ ] Backup your workspaces
- [ ] Export important configurations
- [ ] Document custom integrations
- [ ] Test migration in development environment
- [ ] Schedule downtime for production migration

### Migration Steps

#### Step 1: Backup Current Installation

```bash
# Backup workspaces
cp -r .agent_workspace .agent_workspace.backup

# Backup configuration
cp .env .env.backup

# Backup database (if using)
pg_dump github_devy > backup_$(date +%Y%m%d).sql
```

#### Step 2: Update Dependencies

```bash
# Update to latest version
git pull origin main

# Install new dependencies
npm install

# Update environment variables
cp .env.example .env
# Update with your previous values
```

#### Step 3: Migrate Configuration

Old configuration format:
```env
# Old format
API_KEY=your_key
WORKSPACE_PATH=./workspaces
```

New configuration format:
```env
# New format
GEMINI_API_KEY=your_key
WORKSPACE_ROOT=.agent_workspace
NODE_ENV=production
PORT=9876
```

#### Step 4: Migrate Workspaces

```bash
# Run workspace migration script
npm run migrate:workspaces

# Verify migration
ls -la .agent_workspace/
```

#### Step 5: Update API Calls

Old API endpoints:
```javascript
// Old endpoint
fetch('/api/workspace/list')
```

New API endpoints:
```javascript
// New endpoint
fetch('/api/workspaces')
```

#### Step 6: Test Migration

```bash
# Start development server
npm run dev

# Test critical functionality
# - Workspace creation
# - File operations
# - Terminal operations
# - AI integration
```

#### Step 7: Deploy to Production

```bash
# Build for production
npm run build

# Start production server
npm start

# Monitor logs
tail -f /var/log/github-devy/app.log
```

---

## Breaking Changes

### API Changes

#### Workspace API

**Before:**
```http
GET /api/workspace/list
POST /api/workspace/create
```

**After:**
```http
GET /api/workspaces
POST /api/workspace/create
```

**Migration:**
```javascript
// Update your API calls
- fetch('/api/workspace/list')
+ fetch('/api/workspaces')
```

#### File System API

**Before:**
```http
POST /api/files/read
POST /api/files/write
```

**After:**
```http
POST /api/fs/read
POST /api/fs/write
```

**Migration:**
```javascript
// Update file operation calls
- fetch('/api/files/read', { ... })
+ fetch('/api/fs/read', { ... })
```

### Configuration Changes

#### Environment Variables

**Removed Variables:**
- `API_KEY` → Use `GEMINI_API_KEY` instead
- `WORKSPACE_PATH` → Use `WORKSPACE_ROOT` instead
- `DEBUG_MODE` → Use `DEBUG` instead

**New Variables:**
- `NODE_ENV`: Set to `production` for production
- `PORT`: Server port (default: 9876)
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

#### Workspace Configuration

**Before:**
```json
{
  "id": "workspace-123",
  "name": "my-project",
  "path": "./workspaces/workspace-123"
}
```

**After:**
```json
{
  "id": "workspace-123",
  "name": "my-project",
  "path": ".agent_workspace/workspace-123",
  "settings": {
    "nodeVersion": "18",
    "port": 3000,
    "autoStart": true
  },
  "created": "2024-01-01T00:00:00Z",
  "lastModified": "2024-01-02T12:00:00Z"
}
```

### TypeScript Type Changes

#### Component Props

**Before:**
```typescript
interface Props {
  workspace: any;
  onFileSelect: (file: any) => void;
}
```

**After:**
```typescript
interface Props {
  workspace: Workspace;
  onFileSelect: (file: FileNode) => void;
}
```

#### API Response Types

**Before:**
```typescript
interface Response {
  data: any;
  error?: string;
}
```

**After:**
```typescript
interface Response<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
```

---

## Configuration Changes

### Environment Variables Migration

Create a migration script:

```typescript
// migrate-env.ts
import fs from 'fs';
import dotenv from 'dotenv';

const oldEnv = dotenv.parse(fs.readFileSync('.env.backup'));
const newEnv: Record<string, string> = {};

// Map old variables to new ones
if (oldEnv.API_KEY) {
  newEnv.GEMINI_API_KEY = oldEnv.API_KEY;
}

if (oldEnv.WORKSPACE_PATH) {
  newEnv.WORKSPACE_ROOT = oldEnv.WORKSPACE_PATH;
}

// Add new required variables
newEnv.NODE_ENV = oldEnv.NODE_ENV || 'development';
newEnv.PORT = oldEnv.PORT || '9876';
newEnv.LOG_LEVEL = oldEnv.LOG_LEVEL || 'info';

// Write new .env file
const envContent = Object.entries(newEnv)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

fs.writeFileSync('.env', envContent);
console.log('Environment migration complete!');
```

Run the migration:
```bash
npx tsx migrate-env.ts
```

### Workspace Settings Migration

Update workspace settings:

```typescript
// migrate-workspaces.ts
import fs from 'fs';
import path from 'path';

const workspacesDir = '.agent_workspace';
const workspaceDirs = fs.readdirSync(workspacesDir);

workspaceDirs.forEach(workspaceId => {
  const configPath = path.join(workspacesDir, workspaceId, 'config.json');
  
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // Update configuration
    const newConfig = {
      ...config,
      settings: {
        nodeVersion: '18',
        port: 3000,
        autoStart: true,
        gitIntegration: config.gitIntegration || false
      },
      created: config.created || new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
    
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    console.log(`Migrated workspace: ${workspaceId}`);
  }
});
```

---

## API Changes

### Endpoint Migration

#### File Operations

**Old Endpoints:**
```javascript
// Read file
POST /api/files/read
{ workspaceId: "123", path: "/src/app.ts" }

// Write file
POST /api/files/write
{ workspaceId: "123", path: "/src/app.ts", content: "..." }
```

**New Endpoints:**
```javascript
// Read file
POST /api/fs/read
{ workspaceId: "123", path: "/src/app.ts" }

// Write file
POST /api/fs/write
{ workspaceId: "123", path: "/src/app.ts", content: "..." }
```

#### Command Execution

**Old Endpoints:**
```javascript
// Execute command
POST /api/terminal/exec
{ workspaceId: "123", command: "npm run dev" }
```

**New Endpoints:**
```javascript
// Execute command
POST /api/cmd/exec
{ workspaceId: "123", command: "npm run dev", sessionId: "session-123" }
```

### Response Format Changes

**Old Response Format:**
```json
{
  "data": { ... },
  "error": null
}
```

**New Response Format:**
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "code": null
}
```

**Migration Example:**
```typescript
// Old code
const response = await fetch('/api/files/read', { ... });
const { data, error } = await response.json();

if (error) {
  console.error('Error:', error);
}

// New code
const response = await fetch('/api/fs/read', { ... });
const result = await response.json();

if (!result.success) {
  console.error('Error:', result.error);
}
```

---

## Data Migration

### Workspace Data Migration

#### File Structure Migration

Old structure:
```
workspaces/
  workspace-123/
    files/
      src/
        app.ts
    config.json
```

New structure:
```
.agent_workspace/
  workspace-123/
    src/
      app.ts
    config.json
    cache/
    logs/
```

**Migration Script:**
```bash
#!/bin/bash

# Create new directory structure
mkdir -p .agent_workspace

# Migrate each workspace
for workspace in workspaces/*/; do
  workspace_id=$(basename "$workspace")
  
  # Create new workspace directory
  mkdir -p ".agent_workspace/$workspace_id"
  mkdir -p ".agent_workspace/$workspace_id/cache"
  mkdir -p ".agent_workspace/$workspace_id/logs"
  
  # Move files
  if [ -d "$workspace/files" ]; then
    cp -r "$workspace/files/"* ".agent_workspace/$workspace_id/"
  fi
  
  # Move and update config
  if [ -f "$workspace/config.json" ]; then
    cp "$workspace/config.json" ".agent_workspace/$workspace_id/"
  fi
  
  echo "Migrated workspace: $workspace_id"
done

echo "Migration complete!"
```

### Database Migration

If you're using PostgreSQL:

```sql
-- Create backup
CREATE TABLE github_devy_backup AS SELECT * FROM workspaces;

-- Add new columns
ALTER TABLE workspaces 
ADD COLUMN settings JSONB,
ADD COLUMN created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN last_modified TIMESTAMP DEFAULT NOW();

-- Migrate data
UPDATE workspaces 
SET settings = '{"port": 3000, "autoStart": true}'::jsonb
WHERE settings IS NULL;

-- Create indexes
CREATE INDEX idx_workspaces_created ON workspaces(created_at);
CREATE INDEX idx_workspaces_modified ON workspaces(last_modified);
```

---

## Rollback Procedure

If you need to rollback after migration:

### Step 1: Stop the Application

```bash
# Stop the server
pkill -f "node.*server"
```

### Step 2: Restore Backup

```bash
# Restore workspaces
rm -rf .agent_workspace
cp -r .agent_workspace.backup .agent_workspace

# Restore configuration
cp .env.backup .env

# Restore database (if needed)
psql github_devy < backup_20240101.sql
```

### Step 3: Revert Code Changes

```bash
# Revert to previous commit
git revert <commit-hash>

# Or checkout previous version
git checkout <previous-tag>
```

### Step 4: Restart Application

```bash
# Install previous dependencies
npm install

# Start server
npm start
```

### Step 5: Verify Rollback

```bash
# Test critical functionality
curl http://localhost:9876/health

# Check logs
tail -f /var/log/github-devy/app.log
```

---

## Post-Migration Checklist

- [ ] All workspaces accessible
- [ ] File operations working
- [ ] Terminal commands executing
- [ ] AI integration functional
- [ ] Git operations working
- [ ] Package management functional
- [ ] Database operations working
- [ ] No errors in logs
- [ ] Performance acceptable
- [ ] Users can access their workspaces

---

## Common Migration Issues

### Issue: Workspace Not Found

**Symptom**: Workspaces not appearing after migration

**Solution**:
```bash
# Check workspace directory
ls -la .agent_workspace/

# Verify permissions
chmod -R 755 .agent_workspace/

# Check configuration
cat .agent_workspace/workspace-123/config.json
```

### Issue: API Calls Failing

**Symptom**: API endpoints returning 404 errors

**Solution**:
```javascript
// Update API endpoint URLs
// Check API reference for new endpoints
// Verify request/response formats
```

### Issue: Environment Variables Not Loading

**Symptom**: Configuration not being applied

**Solution**:
```bash
# Verify .env file exists
ls -la .env

# Check environment variables
echo $GEMINI_API_KEY
echo $WORKSPACE_ROOT

# Restart server after changes
npm run dev
```

### Issue: Database Connection Errors

**Symptom**: Cannot connect to database

**Solution**:
```bash
# Check database is running
pg_isready

# Verify connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL
```

---

## Support

If you encounter issues during migration:

1. **Check Documentation**: Review [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)
2. **Search Issues**: Look for similar problems in GitHub Issues
3. **Contact Support**: email support@github-devy.com
4. **Community Help**: Join our Discord server

---

## Additional Resources

- [Main Documentation](DOCUMENTATION.md)
- [API Reference](API_REFERENCE.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)

---

*Last updated: June 2026*