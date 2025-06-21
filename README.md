# 🎵 Axep - Web3 Music Voting Platform

A decentralized music platform that democratizes music discovery through blockchain-based voting and rewards. Artists can submit 2-minute music videos, and the community votes to determine winners.

## 🌐 Live Platform

- **Frontend**: [https://www.axepvoting.io](https://www.axepvoting.io)
- **Backend API**: [https://axep-backend.onrender.com](https://axep-backend.onrender.com)
- **Blockchain**: Polygon Amoy Testnet

## ✨ Features

- **2-Minute Music Videos**: Artists submit high-quality videos up to 2 minutes long
- **Blockchain Voting**: Decentralized voting system using smart contracts
- **IPFS Storage**: Distributed file storage via Pinata
- **Genre Categories**: Multiple music genres supported
- **Reward System**: Token-based rewards for participation
- **Mobile Responsive**: Works seamlessly on all devices

## 🏗️ Architecture

### Frontend
- **React 19** with TypeScript
- **Vite** for fast development and building
- **Material-UI** for modern UI components
- **RainbowKit** for Web3 wallet integration
- **Wagmi** for Ethereum interactions

### Backend
- **Node.js** with Express and TypeScript
- **IPFS Integration** via Pinata
- **Video Processing** with FFprobe for duration validation
- **Security Features** including rate limiting and input validation
- **Production-ready** with comprehensive error handling

### Blockchain
- **Smart Contracts** written in Solidity
- **Hardhat** for development and testing
- **OpenZeppelin** contracts for security
- **Polygon Amoy** testnet deployment

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Yolazega/web3-music-platform-new.git
   cd web3-music-platform-new
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   npm install
   
   # Install backend dependencies
   cd backend && npm install && cd ..
   ```

3. **Environment Setup**
   ```bash
   # Backend environment
   cd backend
   cp .env.example .env
   # Add your PINATA_JWT token
   
   # Frontend environment (if needed)
   cd ..
   cp .env.example .env
   ```

4. **Development**
   ```bash
   # Run both frontend and backend
   npm run dev:all
   
   # Or run separately
   npm run dev              # Frontend only
   npm run dev:backend      # Backend only
   ```

## 📁 Project Structure

```
web3-music-platform-new/
├── src/                    # Frontend React application
│   ├── components/         # React components
│   ├── services/          # API and wallet services
│   ├── contracts/         # Contract interfaces
│   └── utils/             # Utility functions
├── backend/               # Node.js backend
│   ├── src/               # TypeScript source
│   ├── dist/              # Compiled JavaScript
│   └── package.json       # Backend dependencies
├── contracts/             # Solidity smart contracts
├── public/                # Static assets
├── scripts/               # Build and deployment scripts
└── package.json           # Frontend dependencies
```

## 🔧 Configuration

### Backend Configuration
Key environment variables:
- `PINATA_JWT`: Your Pinata API key for IPFS uploads
- `NODE_ENV`: Set to "production" for production builds
- `PORT`: Server port (default: 10000)

### Frontend Configuration
- `VITE_BACKEND_URL`: Backend API URL
- Wallet configuration in `src/services/walletService.ts`

## 📋 Available Scripts

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Backend
- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start production server

### Combined
- `npm run dev:all` - Run both frontend and backend
- `npm run build:all` - Build both frontend and backend
- `npm run clean` - Clean all build artifacts and dependencies

## 🔒 Security Features

- **Rate Limiting**: API endpoints protected against abuse
- **Input Validation**: Comprehensive validation of all inputs
- **File Validation**: Magic number validation for uploaded files
- **CORS Protection**: Configured for secure cross-origin requests
- **Helmet.js**: Security headers and protection
- **Video Duration Limits**: 2-minute maximum enforced server-side

## 🎥 Video Upload Specifications

- **Duration**: Maximum 2 minutes (120 seconds)
- **File Size**: Up to 500MB for high-quality videos
- **Formats**: MP4, MOV supported
- **Quality**: Supports up to 4K resolution
- **Processing**: Server-side validation using FFprobe

## 🌐 Deployment

The platform is deployed on Render.com with:
- **Automatic deployments** from the main branch
- **Environment variable management**
- **Health checks** and monitoring
- **CDN integration** for static assets

### Manual Deployment
```bash
# Build everything
npm run build:all

# Deploy to your hosting provider
# (Configuration in render.yaml)
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/Yolazega/web3-music-platform-new/issues)
- **Documentation**: Check the `/docs` folder for detailed guides
- **Community**: Join our Discord for discussions

## 🔄 Recent Updates

- ✅ **Fixed video upload issues** - Resolved ffprobe-static integration
- ✅ **Repository cleanup** - Removed temporary files and organized dependencies
- ✅ **Enhanced security** - Added comprehensive input validation
- ✅ **Improved performance** - Optimized build process and deployment

---

Built with ❤️ for the decentralized music community
