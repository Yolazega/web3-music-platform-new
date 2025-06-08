import '@rainbow-me/rainbowkit/styles.css';
import {
  RainbowKitProvider,
  getDefaultConfig,
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import * as wagmiChains from 'wagmi/chains';
import { http } from 'wagmi';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link
} from 'react-router-dom';
import './App.css';

import HomePage from './components/HomePage';
import VotingPage from './components/VotingPage';
import UploadPage from './components/UploadPage';
import TokenReward from './components/TokenReward';
import NFTShop from './components/NFTShop';
import AdminPage from './components/AdminPage';

// Define the Amoy chain
const amoy = {
  id: 80002,
  name: 'Polygon Amoy',
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://polygon-amoy.g.alchemy.com/v2/zXMhgwWnKvdqLtEMZmth1'] },
  },
  blockExplorers: {
    default: { name: 'PolygonScan', url: 'https://www.oklink.com/amoy' },
  },
  testnet: true,
} as const satisfies wagmiChains.Chain;

export const wagmiConfig = getDefaultConfig({
  appName: 'Web3 Music Platform',
  projectId: 'c3c741154a4395a6e877ab4335c05562',
  chains: [amoy],
  ssr: false,
});

const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Router>
            <div className="App">
              <nav style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Link to="/" style={{ marginRight: '15px' }}>Home</Link>
                  <Link to="/vote" style={{ marginRight: '15px' }}>Vote</Link>
                  <Link to="/upload" style={{ marginRight: '15px' }}>Upload</Link>
                  <Link to="/rewards" style={{ marginRight: '15px' }}>Rewards</Link>
                  <Link to="/nftshop" style={{ marginRight: '15px' }}>NFT Shop</Link>
                  <Link to="/admin" style={{ marginRight: '15px', border: '1px solid grey', padding: '2px 5px' }}>Admin</Link>
                </div>
                <ConnectButton />
              </nav>

              <main style={{ padding: '20px' }}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/vote" element={<VotingPage />} />
                  <Route path="/upload" element={<UploadPage />} />
                  <Route path="/rewards" element={<TokenReward />} />
                  <Route path="/nftshop" element={<NFTShop />} />
                  <Route path="/admin" element={<AdminPage />} />
                </Routes>
              </main>
            </div>
          </Router>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
