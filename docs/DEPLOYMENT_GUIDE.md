# Deployment Guide

Complete guide for deploying Github-devy to various platforms.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Deployment](#docker-deployment)
4. [Cloud Deployment](#cloud-deployment)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Monitoring](#monitoring)
7. [Security](#security)
8. [Maintenance](#maintenance)

---

## Prerequisites

### System Requirements

- **CPU**: 2+ cores recommended
- **Memory**: 4GB+ RAM recommended
- **Storage**: 20GB+ available space
- **Network**: Stable internet connection

### Software Requirements

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **kubectl**: 1.25+ (for Kubernetes)
- **Node.js**: 18+ (for local development)

---

## Environment Setup

### Production Environment Variables

Create `.env.production`:

```env
# Server Configuration
NODE_ENV=production
PORT=9876
HOST=0.0.0.0

# AI Configuration
GEMINI_API_KEY=your_production_gemini_key
OLLAMA_URL=http://ollama:11434

# GitHub Integration
GITHUB_TOKEN=your_github_token

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/github_devy

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Storage Configuration
WORKSPACE_ROOT=/var/lib/github-devy/workspaces
MAX_WORKSPACE_SIZE=10737418240

# Security
SESSION_SECRET=your_random_session_secret
JWT_SECRET=your_random_jwt_secret

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/github-devy/app.log

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
```

### SSL/TLS Configuration

Generate SSL certificates:

```bash
# Generate self-signed certificate (for development)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Or use Let's Encrypt (for production)
certbot certonly --standalone -d yourdomain.com
```

---

## Docker Deployment

### Basic Docker Setup

#### Dockerfile

```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Create workspace directory
RUN mkdir -p /var/lib/github-devy/workspaces && \
    chown -R nodejs:nodejs /var/lib/github-devy

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 9876

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9876/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.cjs"]
```

#### .dockerignore

```
node_modules
npm-debug.log
.env.local
.env.*.local
.git
.gitignore
README.md
.md
.vscode
.idea
*.log
coverage
.nyc_output
dist
.agent_workspace
.DS_Store
```

### Docker Compose Setup

#### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: github-devy
    restart: unless-stopped
    ports:
      - "9876:9876"
    environment:
      - NODE_ENV=production
      - PORT=9876
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/github_devy
      - REDIS_URL=redis://redis:6379
    volumes:
      - workspaces:/var/lib/github-devy/workspaces
      - logs:/var/log/github-devy
    depends_on:
      - postgres
      - redis
    networks:
      - github-devy-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:9876/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:15-alpine
    container_name: github-devy-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=github_devy
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - github-devy-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: github-devy-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - github-devy-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    container_name: github-devy-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - app
    networks:
      - github-devy-network

volumes:
  workspaces:
    driver: local
  logs:
    driver: local
  postgres-data:
    driver: local
  redis-data:
    driver: local

networks:
  github-devy-network:
    driver: bridge
```

#### nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:9876;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    server {
        listen 80;
        server_name yourdomain.com;

        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        # SSL configuration
        ssl_certificate /etc/nginx/certs/cert.pem;
        ssl_certificate_key /etc/nginx/certs/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Proxy configuration
        location / {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # WebSocket support
        location /terminal {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_read_timeout 86400;
        }

        # Static files
        location /static/ {
            proxy_pass http://app;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### Building and Running

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

---

## Cloud Deployment

### Vercel Deployment

#### vercel.json

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server.ts"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "server.ts": {
      "maxDuration": 60
    }
  }
}
```

#### Deployment Steps

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Set environment variables
vercel env add GEMINI_API_KEY production
vercel env add OLLAMA_URL production
```

### AWS Deployment

#### Elastic Beanstalk

Create `Dockerrun.aws.json`:

```json
{
  "AWSEBDockerrunVersion": "1",
  "Image": {
    "Name": "your-registry/github-devy:latest",
    "Update": "true"
  },
  "Ports": [
    {
      "ContainerPort": "9876"
    }
  ],
  "Environment": [
    {
      "Name": "NODE_ENV",
      "Value": "production"
    },
    {
      "Name": "PORT",
      "Value": "9876"
    }
  ],
  "Volumes": [
    {
      "HostDirectory": "/var/lib/github-devy",
      "ContainerDirectory": "/var/lib/github-devy"
    }
  ],
  "Logging": "/var/log/nginx"
}
```

#### Deployment Commands

```bash
# Initialize EB CLI
eb init -p docker github-devy

# Create environment
eb create production

# Deploy
eb deploy

# Open application
eb open
```

### Google Cloud Run

#### cloudbuild.yaml

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/github-devy:$COMMIT_SHA', '.']
  
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/github-devy:$COMMIT_SHA']
  
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'github-devy'
      - '--image'
      - 'gcr.io/$PROJECT_ID/github-devy:$COMMIT_SHA'
      - '--platform'
      - 'managed'
      - '--region'
      - 'us-central1'
      - '--allow-unauthenticated'
      - '--memory'
      - '2Gi'
      - '--cpu'
      - '2'
```

#### Deployment Commands

```bash
# Set project
gcloud config set project your-project-id

# Deploy
gcloud builds submit --config cloudbuild.yaml

# Set environment variables
gcloud run services update github-devy \
  --set-env-vars NODE_ENV=production \
  --set-env-vars GEMINI_API_KEY=$GEMINI_API_KEY
```

### Azure Deployment

#### Azure Container Instances

```bash
# Create resource group
az group create --name github-devy-rg --location eastus

# Create container registry
az acr create --resource-group github-devy-rg --name githubdevyacr --sku Basic

# Build and push image
az acr build --registry githubdevyacr --image github-devy:latest .

# Create container instance
az container create \
  --resource-group github-devy-rg \
  --name github-devy \
  --image githubdevyacr.azurecr.io/github-devy:latest \
  --cpu 2 \
  --memory 4 \
  --ports 9876 \
  --environment-variables NODE_ENV=production
```

---

## Kubernetes Deployment

### Kubernetes Manifests

#### deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: github-devy
  labels:
    app: github-devy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: github-devy
  template:
    metadata:
      labels:
        app: github-devy
    spec:
      containers:
      - name: github-devy
        image: your-registry/github-devy:latest
        ports:
        - containerPort: 9876
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "9876"
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: github-devy-secrets
              key: gemini-api-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 9876
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 9876
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: workspaces
          mountPath: /var/lib/github-devy/workspaces
      volumes:
      - name: workspaces
        persistentVolumeClaim:
          claimName: github-devy-pvc
```

#### service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: github-devy
spec:
  selector:
    app: github-devy
  ports:
  - protocol: TCP
    port: 80
    targetPort: 9876
  type: LoadBalancer
```

#### pvc.yaml

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: github-devy-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
```

#### secret.yaml

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: github-devy-secrets
type: Opaque
stringData:
  gemini-api-key: "your-gemini-api-key"
  jwt-secret: "your-jwt-secret"
  session-secret: "your-session-secret"
```

#### configmap.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: github-devy-config
data:
  NODE_ENV: "production"
  PORT: "9876"
  LOG_LEVEL: "info"
```

### Deployment Commands

```bash
# Apply all manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get deployments
kubectl get pods
kubectl get services

# View logs
kubectl logs -f deployment/github-devy

# Scale deployment
kubectl scale deployment github-devy --replicas=5

# Update deployment
kubectl set image deployment/github-devy github-devy=your-registry/github-devy:v2.0.0
```

### Helm Chart

Create Helm chart for easier deployment:

```yaml
# Chart.yaml
apiVersion: v2
name: github-devy
description: A Helm chart for Github-devy
type: application
version: 1.0.0
appVersion: "1.0.0"
```

```yaml
# values.yaml
replicaCount: 3

image:
  repository: your-registry/github-devy
  pullPolicy: IfNotPresent
  tag: "latest"

service:
  type: LoadBalancer
  port: 80

resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 500m
    memory: 512Mi

persistence:
  enabled: true
  size: 20Gi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
  targetMemoryUtilizationPercentage: 80
```

```bash
# Install Helm chart
helm install github-devy ./charts/github-devy

# Upgrade deployment
helm upgrade github-devy ./charts/github-devy

# Uninstall
helm uninstall github-devy
```

---

## Monitoring

### Health Checks

Implement health check endpoint:

```typescript
app.get('/health', (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'healthy',
    checks: {
      database: checkDatabase(),
      redis: checkRedis(),
      disk: checkDiskSpace()
    }
  };
  
  res.json(health);
});
```

### Logging

#### Structured Logging

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### Metrics

#### Prometheus Metrics

```typescript
import promClient from 'prom-client';

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.observe({
      method: req.method,
      route: req.path,
      status_code: res.statusCode
    }, duration);
  });
  next();
});
```

### Monitoring Tools

#### Grafana Dashboard

Create comprehensive monitoring dashboard:

- Request rate and latency
- Error rates
- Resource usage (CPU, memory, disk)
- Database performance
- WebSocket connections
- Workspace statistics

---

## Security

### Security Headers

```typescript
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

### Input Validation

```typescript
import { body, validationResult } from 'express-validator';

app.post('/api/workspace/create', 
  body('name').trim().isLength({ min: 1, max: 100 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Process request
  }
);
```

---

## Maintenance

### Backup Strategy

#### Database Backup

```bash
# PostgreSQL backup
pg_dump -U postgres github_devy > backup_$(date +%Y%m%d).sql

# Restore backup
psql -U postgres github_devy < backup_20240101.sql
```

#### Workspace Backup

```bash
# Backup workspaces
tar -czf workspaces_backup_$(date +%Y%m%d).tar.gz /var/lib/github-devy/workspaces

# Restore backup
tar -xzf workspaces_backup_20240101.tar.gz -C /var/lib/github-devy/
```

### Update Strategy

#### Rolling Updates

```bash
# Kubernetes rolling update
kubectl set image deployment/github-devy github-devy=your-registry/github-devy:v2.0.0

# Docker Compose rolling update
docker-compose up -d --no-deps --build app
```

### Cleanup

#### Old Workspaces

```bash
# Remove workspaces older than 30 days
find /var/lib/github-devy/workspaces -type d -mtime +30 -exec rm -rf {} \;
```

#### Log Rotation

```bash
# Configure logrotate
cat > /etc/logrotate.d/github-devy << EOF
/var/log/github-devy/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 nodejs nodejs
    sharedscripts
    postrotate
        docker kill -s USR1 github-devy
    endscript
}
EOF
```

---

*Last updated: June 2026*