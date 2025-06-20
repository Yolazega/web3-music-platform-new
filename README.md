# AXEP - Web3 Music Voting Platform

A decentralized music platform where artists can submit tracks and users can vote for their favorites using blockchain technology.

## 🎵 Features

- **Artist Track Submission**: Upload music tracks with metadata to IPFS
- **Decentralized Voting**: Vote for tracks using Polygon Amoy testnet
- **Token Rewards**: Earn AXP tokens for participation
- **Admin Dashboard**: Manage submissions and track analytics
- **Wallet Integration**: Connect with MetaMask and other Web3 wallets
- **Weekly Competitions**: Time-based voting periods with winners

## 🏗️ Architecture

### Frontend (React + TypeScript + Vite)
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite for fast development and building
- **Web3 Integration**: Wagmi + RainbowKit for wallet connectivity
- **UI Components**: Material-UI for consistent design
- **State Management**: React hooks with Tanstack Query

### Backend (Node.js + Express)
- **Runtime**: Node.js with Express.js
- **File Storage**: IPFS via Pinata for decentralized storage
- **Database**: JSON file-based storage (can be upgraded to PostgreSQL)
- **Authentication**: Wallet-based authentication

### Smart Contracts (Solidity)
- **Network**: Polygon Amoy Testnet
- **Voting Contract**: `0x83072BC70659AB6aCcd0A46C05bF2748F2Cb2D8e`
- **Token Contract**: `0xa1edD20366dbAc7341DE5fdb9FE1711Fb9EAD4d4`

## 🚀 Deployment

### Render.com Configuration

The project is configured for deployment on Render using a Blueprint approach:

```yaml
services:
  # Backend Web Service
  - type: web
    name: axep-backend
    env: node
    rootDir: ./backend
    buildCommand: "npm install && npm run build"
    startCommand: "npm start"
    envVars:
      - key: PINATA_JWT
        sync: false
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "10000"

  # Frontend Static Site
  - type: web
    name: axep-frontend
    env: static
    rootDir: ./
    buildCommand: "npm install && npm run build"
    staticPublishPath: ./dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_BACKEND_URL
        fromService:
          type: web
          name: axep-backend
          property: url
```

### Environment Variables

#### Backend
- `PINATA_JWT`: JWT token for IPFS uploads via Pinata
- `NODE_ENV`: Set to "production" for production builds
- `PORT`: Server port (default: 3001, Render uses 10000)

#### Frontend
- `VITE_BACKEND_URL`: Automatically set by Render from backend service URL

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd web3-music-platform-new
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   npm install
   
   # Install backend dependencies
   cd backend
   npm install
   cd ..
   ```

3. **Set up environment variables**
   ```bash
   # Backend .env file
   cd backend
   echo "PINATA_JWT=your_pinata_jwt_here" > .env
   cd ..
   ```

4. **Start development servers**
   ```bash
   # Terminal 1: Frontend
   npm run dev
   
   # Terminal 2: Backend
   cd backend
   npm run dev
   ```

## 📁 Project Structure

```
web3-music-platform-new/
├── src/                      # Frontend source code
│   ├── components/           # React components
│   │   ├── AdminPage.tsx     # Admin dashboard
│   │   ├── HomePage.tsx      # Landing page
│   │   ├── UploadPage.tsx    # Track submission
│   │   ├── VotingPage.tsx    # Voting interface
│   │   └── ...
│   ├── services/             # API and Web3 services
│   │   ├── api.ts           # Backend API client
│   │   └── walletService.ts # Wallet configuration
│   ├── config.ts            # Contract addresses and ABIs
│   └── types.ts             # TypeScript type definitions
├── backend/                  # Backend source code
│   ├── src/
│   │   ├── index.ts         # Main server file
│   │   ├── pinata.ts        # IPFS upload service
│   │   ├── config.ts        # Backend configuration
│   │   └── time.ts          # Time-based utilities
│   └── package.json
├── contracts/               # Smart contract source
├── public/                  # Static assets
├── render.yaml             # Render deployment configuration
└── package.json            # Frontend dependencies
```

## 🔧 Key Technologies

- **Frontend**: React 19, TypeScript, Vite, Material-UI
- **Backend**: Node.js, Express, TypeScript
- **Blockchain**: Ethereum/Polygon, Solidity, Ethers.js
- **Web3**: Wagmi, RainbowKit, Viem
- **Storage**: IPFS (Pinata), JSON database
- **Deployment**: Render.com

## 🎯 Core Functionality

### Track Submission Flow
1. Artist connects wallet
2. Uploads track file and cover image
3. Files stored on IPFS via Pinata
4. Metadata stored in backend database
5. Admin approves/rejects submission
6. Approved tracks published to blockchain

### Voting Flow
1. User connects wallet
2. Views published tracks for current week
3. Casts vote (one per track per week)
4. Vote recorded on blockchain
5. Weekly tallying determines winners

### Admin Features
- Review and approve/reject submissions
- Publish approved tracks to blockchain
- Tally votes and determine winners
- Manage share submissions for rewards
- View analytics and statistics

## 🔐 Security Features

- **Wallet-based Authentication**: Admin access via contract owner verification
- **Input Validation**: Server-side validation for all submissions
- **Rate Limiting**: Time-based submission and voting periods
- **CORS Protection**: Configured for specific domains
- **File Upload Limits**: 50MB limit for media files

## 🌐 Live URLs

- **Frontend**: https://axep-frontend.onrender.com
- **Backend**: https://axep-backend.onrender.com
- **Custom Domain**: https://www.axepvoting.io

## 📊 Smart Contract Details

### Voting Contract Functions
- `batchRegisterAndUpload()`: Publish multiple tracks
- `vote()`: Cast vote for a track
- `tallyVotes()`: Calculate weekly winners
- `recordShare()`: Record social media shares
- `distributeShareRewards()`: Distribute rewards

### Token Contract (AXP)
- Standard ERC-20 token for platform rewards
- Used for voting rewards and incentives

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation in the code comments

---

Built with ❤️ for the decentralized music community
