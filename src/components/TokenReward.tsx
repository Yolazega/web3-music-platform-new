import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { AMOY_CHAIN_ID } from '../config';

const TokenRewardPage: React.FC = () => {
  const { address, chain } = useAccount();
  
  const [error] = useState<string | null>(null);

  const isConnectedOnAmoy = address && chain && chain.id.toString() === parseInt(AMOY_CHAIN_ID, 16).toString();

  if (!address) { return <p>Please connect your wallet to view this page.</p>; }
  if (!isConnectedOnAmoy) {
    return <p style={{ color: 'orange' }}>Please switch to Polygon Amoy Testnet to view this page.</p>;
  }

  return (
    <div>
      <h2>Claim Token Rewards for Sharing</h2>
      <div style={{ margin: '20px 0', padding: '15px', background: '#e6f7ff', borderRadius: '5px'}}>
        <h4>Reward System Under Construction</h4>
        <p>The reward mechanism for sharing tracks is currently being redesigned to align with our new smart contract.</p>
        <p>Previously, rewards were based on sharing weekly "winner" tracks. This feature is being re-evaluated to create a more robust and decentralized system.</p>
        <p>Please check back later for updates. We appreciate your patience!</p>
        {error && <p style={{color: 'red'}}>Error: {error}</p>}
      </div>
    </div>
  );
};

export default TokenRewardPage;
