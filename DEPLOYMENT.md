# Production Deployment Guide

## 🚀 Deployment Overview

This guide provides step-by-step instructions for deploying the Web3 Music Platform to production with all security measures enabled.

## 📋 Pre-Deployment Checklist

### ✅ Environment Setup
- [ ] Render.com account with increased pipeline spend limit
- [ ] Pinata account with JWT token
- [ ] Domain configured (axepvoting.io)
- [ ] SSL certificates configured
- [ ] Monitoring tools setup

### ✅ Security Configuration
- [ ] All environment variables configured
- [ ] Rate limiting settings reviewed
- [ ] CORS origins updated for production
- [ ] File upload limits configured
- [ ] Security headers enabled

### ✅ Performance Optimization
- [ ] Server timeouts configured
- [ ] Memory limits set
- [ ] Database backup strategy
- [ ] CDN configuration (if applicable)

## 🔧 Environment Variables

### Required Variables
```bash
# Core Settings
NODE_ENV=production
PORT=3001
PINATA_JWT=your_actual_pinata_jwt_token

# Security Settings
API_RATE_LIMIT=100
UPLOAD_RATE_LIMIT=10
MAX_FILE_SIZE=52428800
MAX_IMAGE_SIZE=10485760

# CORS Settings
ALLOWED_ORIGINS=https://www.axepvoting.io,https://axep-frontend.onrender.com

# Database
RENDER_DISK_MOUNT_PATH=/opt/render/project/data
```

### Optional Variables
```bash
# Monitoring
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=info

# Performance
SERVER_TIMEOUT=600000
UPLOAD_TIMEOUT=300000
NODE_OPTIONS=--max-old-space-size=512

# Features
ENABLE_FILE_VALIDATION=true
ENABLE_VIRUS_SCANNING=false
MAINTENANCE_MODE=false
```

## 🏗️ Render.com Deployment

### Backend Deployment
1. **Create Web Service**
   ```
   Repository: https://github.com/Yolazega/web3-music-platform-new.git
   Branch: main
   Root Directory: backend
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

2. **Environment Configuration**
   - Add all required environment variables
   - Set NODE_ENV=production
   - Configure persistent disk for database

3. **Resource Configuration**
   ```
   Instance Type: Standard (512MB RAM minimum)
   Auto-Deploy: Enabled
   Health Check Path: /health
   ```

### Frontend Deployment
1. **Create Static Site**
   ```
   Repository: https://github.com/Yolazega/web3-music-platform-new.git
   Branch: main
   Root Directory: /
   Build Command: npm install && npm run build
   Publish Directory: dist
   ```

2. **Environment Configuration**
   ```
   VITE_BACKEND_URL=https://axep-backend.onrender.com
   ```

## 🔒 Security Configuration

### Render.com Security Settings
1. **Environment Variables**
   - All secrets stored as environment variables
   - No sensitive data in code repository
   - Regular rotation of API keys

2. **Network Security**
   - HTTPS enforced
   - Custom domain with SSL
   - Security headers enabled

3. **Access Control**
   - Team access properly configured
   - Deploy keys secured
   - Webhook security enabled

### Application Security
1. **Rate Limiting**
   - API: 100 requests per 15 minutes per IP
   - Uploads: 10 uploads per 15 minutes per IP
   - Automatic IP blocking for violations

2. **File Upload Security**
   - Magic number validation
   - File size limits enforced
   - Secure temp file handling
   - Automatic cleanup

3. **Input Validation**
   - All inputs sanitized
   - Wallet address validation
   - Genre whitelist enforcement

## 📊 Monitoring & Logging

### Health Checks
```bash
# Backend health check
curl https://axep-backend.onrender.com/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-01-XX...",
  "uptime": 3600,
  "memory": {...},
  "version": "v18.x.x"
}
```

### Log Monitoring
1. **Application Logs**
   - Request/response logging
   - Error logging with context
   - Security event logging
   - Performance metrics

2. **Infrastructure Logs**
   - Server resource usage
   - Network traffic patterns
   - Deployment logs
   - Build logs

### Alerting
1. **Critical Alerts**
   - Service downtime
   - High error rates
   - Security violations
   - Resource exhaustion

2. **Warning Alerts**
   - Slow response times
   - High upload volumes
   - Rate limit violations
   - Unusual traffic patterns

## 🔄 Deployment Process

### Automated Deployment
1. **Git Workflow**
   ```bash
   # Development
   git checkout -b feature/new-feature
   # Make changes
   git commit -m "feat: description"
   git push origin feature/new-feature
   
   # Production deployment
   git checkout main
   git merge feature/new-feature
   git push origin main  # Triggers auto-deploy
   ```

2. **Build Process**
   ```bash
   # Backend build
   npm install
   npm run build
   npm start
   
   # Frontend build
   npm install
   npm run build
   # Static files served from dist/
   ```

### Manual Deployment
1. **Emergency Deployment**
   - Use Render dashboard
   - Manual deploy from specific commit
   - Rollback capability available

2. **Rollback Process**
   ```bash
   # Identify last good commit
   git log --oneline
   
   # Create rollback branch
   git checkout -b rollback/emergency
   git reset --hard <good-commit-hash>
   git push origin rollback/emergency
   
   # Deploy rollback branch via Render dashboard
   ```

## 🧪 Testing in Production

### Smoke Tests
```bash
# Test basic functionality
curl https://axep-backend.onrender.com/
curl https://axep-backend.onrender.com/health
curl https://axep-backend.onrender.com/tracks

# Test frontend
curl https://www.axepvoting.io
```

### Upload Testing
1. **Test file upload with valid files**
2. **Test file validation (invalid files)**
3. **Test rate limiting**
4. **Test error handling**

### Security Testing
1. **CORS validation**
2. **Rate limiting verification**
3. **Input sanitization testing**
4. **Error message validation**

## 📈 Performance Optimization

### Backend Optimization
1. **Memory Management**
   - Node.js memory limit: 512MB
   - Garbage collection optimization
   - Memory leak monitoring

2. **Response Optimization**
   - Gzip compression (via reverse proxy)
   - Response caching headers
   - Database query optimization

### Frontend Optimization
1. **Asset Optimization**
   - Code splitting
   - Asset compression
   - CDN integration

2. **Loading Performance**
   - Lazy loading
   - Progressive enhancement
   - Service worker caching

## 🔧 Maintenance

### Regular Maintenance
1. **Weekly Tasks**
   - Review application logs
   - Check error rates
   - Monitor resource usage
   - Verify backup integrity

2. **Monthly Tasks**
   - Security dependency updates
   - Performance review
   - Capacity planning
   - Security audit

### Emergency Procedures
1. **Service Outage**
   - Check Render service status
   - Review application logs
   - Verify external service status
   - Implement emergency measures

2. **Security Incident**
   - Immediate response protocol
   - Log analysis
   - Threat mitigation
   - Incident documentation

## 📞 Support Contacts

### Technical Support
- **Platform Issues**: Render.com support
- **IPFS Issues**: Pinata support
- **Domain Issues**: Domain registrar support

### Application Support
- **Code Issues**: Development team
- **Security Issues**: security@axepvoting.io
- **Performance Issues**: DevOps team

## 🔄 Backup & Recovery

### Database Backup
1. **Automatic Backups**
   - Daily database snapshots
   - Persistent disk backups
   - Off-site backup storage

2. **Recovery Process**
   - Point-in-time recovery
   - Data integrity verification
   - Service restoration

### Disaster Recovery
1. **Complete Service Recovery**
   - Infrastructure recreation
   - Data restoration
   - Service verification

2. **Business Continuity**
   - Communication plan
   - User notification
   - Service level agreements

---

**Last Updated**: January 2025  
**Deployment Version**: Production v1.0  
**Next Review**: Monthly deployment review 