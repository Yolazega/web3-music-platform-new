import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { wagmiConfig, queryClient } from './wagmi';
import './App.css';
import '@rainbow-me/rainbowkit/styles.css';

import HomePage from './components/HomePage';
import VotingPage from './components/VotingPage';
import UploadPage from './components/UploadPage';
import TokenReward from './components/TokenReward';
import NFTShop from './components/NFTShop';
import AdminPage from './components/AdminPage';
import GenrePage from './components/GenrePage';

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
                  <Link to="/admin" style={{ marginRight: '15px' }}>Admin</Link>
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
                  <Route path="/genre/:genreName" element={<GenrePage />} />
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
