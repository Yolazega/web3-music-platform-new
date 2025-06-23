# 🚂 Railway Backend Environment Variables Checklist

## ✅ Required Variables for axep-backend service:

```bash
# Core Configuration
NODE_ENV=production
PORT=3001
TZ=America/New_York

# Blockchain (fill with your actual values)
POLYGON_RPC=https://rpc-amoy.polygon.technology
PRIVATE_KEY=your-actual-wallet-private-key
VOTING_ADDRESS=your-actual-voting-contract-address

# Pinata (fill with your actual values)  
PINATA_KEY=your-actual-pinata-api-key
PINATA_SECRET=your-actual-pinata-secret-key
PINATA_JWT=your-actual-pinata-jwt-token

# CORS (temporary - update after frontend deployment)
CORS_ORIGIN=*

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🔧 Railway Configuration Steps:

1. **Service Settings**:
   - Root Directory: `web3-music-platform-new/backend`
   - Build Command: `npm run build` 
   - Start Command: `npm start`

2. **Add Variables**: Copy the variables above into Railway Variables tab

3. **Deploy**: Save and redeploy

## 🔍 Common Issues:
- Missing ROOT directory configuration
- Missing environment variables
- Wrong start command 