# Deployment Checklist & Troubleshooting Guide

## ✅ Pre-Deployment Checklist

### Environment Configuration
- [ ] **PINATA_JWT** - Set in Render backend service environment variables
- [ ] **NODE_ENV** - Set to "production" for backend
- [ ] **PORT** - Set to "10000" for Render backend
- [ ] **VITE_BACKEND_URL** - Automatically configured via render.yaml

### Code Configuration
- [ ] **Contract Addresses** - Updated in both frontend and backend config.ts
  - Voting Contract: `0x83072BC70659AB6aCcd0A46C05bF2748F2Cb2D8e`
  - Token Contract: `0xa1edD20366dbAc7341DE5fdb9FE1711Fb9EAD4d4`
- [ ] **CORS Origins** - Backend includes production domains
- [ ] **API URL** - Frontend points to correct backend service

### Build Verification
- [ ] **Frontend Build** - `npm run build` completes successfully
- [ ] **Backend Build** - `cd backend && npm run build` completes successfully
- [ ] **TypeScript Compilation** - No errors in either service

## 🚀 Deployment Steps

1. **Push to Repository**
   ```bash
   git add .
   git commit -m "Deploy: Fix all configuration issues"
   git push origin main
   ```

2. **Deploy via Render Blueprint**
   - Go to Render.com dashboard
   - Create new Blueprint
   - Connect GitHub repository
   - Select `render.yaml` configuration
   - Deploy both services

3. **Verify Deployment**
   - [ ] Backend health check: `https://axep-backend.onrender.com/`
   - [ ] Frontend loads: `https://axep-frontend.onrender.com/`
   - [ ] Wallet connection works
   - [ ] Admin page authentication works

## 🔧 Common Issues & Solutions

### Backend Issues

#### TypeScript Build Errors
- **Issue**: `fileUpload()` TypeScript error
- **Solution**: Use type assertion `as any` for middleware

#### CORS Errors
- **Issue**: Frontend can't connect to backend
- **Solution**: Ensure CORS origins include production domains:
  ```typescript
  app.use(cors({
      origin: ['http://localhost:3000', 'https://axep-frontend.onrender.com', 'https://www.axepvoting.io'],
      credentials: true
  }));
  ```

#### Environment Variables
- **Issue**: PINATA_JWT not set
- **Solution**: Add via Render dashboard > Service > Environment

### Frontend Issues

#### Build Warnings
- **Issue**: Large chunk size warnings
- **Solution**: Acceptable for Web3 apps due to crypto libraries

#### API Connection
- **Issue**: API calls failing
- **Solution**: Check `VITE_BACKEND_URL` environment variable

#### Wallet Connection
- **Issue**: RainbowKit not connecting
- **Solution**: Verify WalletConnect Project ID is valid

### Render.com Specific

#### Service Names
- **Issue**: Services not finding each other
- **Solution**: Ensure service names match in render.yaml:
  - Backend: `axep-backend`
  - Frontend: `axep-frontend`

#### Build Timeouts
- **Issue**: Build taking too long
- **Solution**: Render free tier has 15-minute build limit

#### Static Site Routing
- **Issue**: React Router not working on refresh
- **Solution**: Configure rewrite rules in render.yaml:
  ```yaml
  routes:
    - type: rewrite
      source: /*
      destination: /index.html
  ```

## 📊 Health Checks

### Backend Health Check
```bash
curl https://axep-backend.onrender.com/
# Expected: "Hello from the Web3 Music Platform backend!"
```

### Frontend Health Check
- Visit: https://axep-frontend.onrender.com/
- Check: Page loads without errors
- Test: Wallet connection button appears

### Admin Authentication Check
1. Connect wallet as contract owner
2. Navigate to `/admin`
3. Verify: Admin dashboard loads with proper permissions

## 🔄 Rollback Plan

If deployment fails:

1. **Check Render Logs**
   - Backend service logs for errors
   - Frontend build logs for issues

2. **Revert Changes**
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Manual Fix**
   - Fix specific issues locally
   - Test builds locally
   - Redeploy

## 📝 Post-Deployment Tasks

- [ ] Test all major user flows
- [ ] Verify admin functionality
- [ ] Check social media sharing
- [ ] Monitor error logs
- [ ] Update DNS if using custom domain

## 🔍 Monitoring

### Key Metrics to Watch
- Backend response times
- Frontend load times
- Wallet connection success rate
- IPFS upload success rate
- Smart contract interaction success

### Log Locations
- **Backend**: Render service logs
- **Frontend**: Browser developer console
- **Smart Contract**: Polygon Amoy explorer

## 🆘 Emergency Contacts

- **Render Support**: help@render.com
- **Repository Issues**: Create GitHub issue
- **Smart Contract**: Polygon Amoy testnet explorer

---

*Last Updated: January 2025* 