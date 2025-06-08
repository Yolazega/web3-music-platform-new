import React from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useBalance } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AXP_TOKEN_CONTRACT_ADDRESS, AMOY_CHAIN_ID } from 'config';

const HomePage: React.FC = () => {
  const { address, chain } = useAccount();

  const { data: axpBalance } = useBalance({
    address,
    token: AXP_TOKEN_CONTRACT_ADDRESS as `0x${string}`,
  });

  const isConnectedOnAmoy = address && chain && chain.id.toString() === parseInt(AMOY_CHAIN_ID, 16).toString();
  const genres = ["Pop", "Soul", "Rock", "Country", "RAP", "Afro / Dancehall", "Electronic", "Instrumental / Other"];

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    fontFamily: 'sans-serif',
    color: '#333',
    padding: '20px',
    minHeight: '100vh',
    backgroundColor: '#fff',
  };

  const genreBarStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: '800px',
    margin: '20px 0 40px 0',
    padding: '10px 0',
    borderBottom: '1px solid #eee',
  };

  const genreItemStyle: React.CSSProperties = {
    padding: '10px 20px',
    fontWeight: 'bold',
    cursor: 'pointer',
    borderRadius: '20px',
    backgroundColor: '#f0f0f0',
  };

  const heroSectionStyle: React.CSSProperties = {
    margin: '40px 0',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '4em',
    fontWeight: 'bold',
    letterSpacing: '0.1em',
    margin: '0',
  };

  const descriptionStyle: React.CSSProperties = {
    maxWidth: '600px',
    margin: '20px auto 40px auto',
    fontSize: '1.1em',
    lineHeight: '1.6',
    color: '#555',
  };
  
  const quoteStyle: React.CSSProperties = {
    fontStyle: 'italic',
    color: '#777',
    marginTop: '20px',
  };

  const winnerSectionStyle: React.CSSProperties = {
    marginTop: '50px',
    width: '100%',
    maxWidth: '800px',
  };

  const winnerTitleStyle: React.CSSProperties = {
    fontSize: '1.5em',
    color: '#444',
  };

  const winnerPlaceholderStyle: React.CSSProperties = {
    width: '100%',
    height: '150px',
    backgroundColor: '#333',
    borderRadius: '10px',
    margin: '20px 0',
  };
  
  const navStyle: React.CSSProperties = {
      marginTop: '50px',
      paddingTop: '20px',
      borderTop: '1px solid #eee',
      width: '100%',
      maxWidth: '800px'
  };
  
  const navListStyle: React.CSSProperties = {
      listStyle: 'none',
      padding: 0,
      display: 'flex',
      justifyContent: 'center',
      gap: '20px'
  };

  return (
    <div style={containerStyle}>
      <div style={genreBarStyle}>
        {genres.map(genre => (
          <div key={genre} style={genreItemStyle}>{genre}</div>
        ))}
      </div>
      
      <div style={heroSectionStyle}>
        <h1 style={titleStyle}>VOTE SHARE CLAIM</h1>
        <p style={descriptionStyle}>
          Axep is a Web3-based music platform that rewards both artists and fans. The platform
          democratizes online casting by issuing tokens as rewards for social media activity. The goal is to
          reduce the dominant role of major music labels and provide artists and supporters with direct
          benefits from their engagement.
        </p>
        <p style={quoteStyle}>"The times when fans did not participate in the success of the artists they supported are over."</p>
      </div>

      <div style={{...heroSectionStyle, display: !address ? 'block' : 'none'}}>
        <p>Please connect your wallet to see more.</p>
      </div>

      <div style={winnerSectionStyle}>
        <h2 style={winnerTitleStyle}>Current Main Winner</h2>
        <div style={winnerPlaceholderStyle}></div>
      </div>

      {address && axpBalance && (
        <div style={{margin: '20px 0', padding: '15px', background: '#e8f4ff', borderRadius: '5px', border: '1px solid #b3d7ff', width: '100%', maxWidth: '800px'}}>
          <h3>Your {axpBalance.symbol} Balance</h3>
          <p style={{fontSize: '1.2em', fontWeight: 'bold', color: '#0056b3'}}>
            {parseFloat(axpBalance.formatted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {axpBalance.symbol}
          </p>
        </div>
      )}

      {address && isConnectedOnAmoy && (
          <nav style={navStyle}>
            <ul style={navListStyle}>
              <li><Link to="/vote">Vote</Link></li>
              <li><Link to="/upload">Upload</Link></li>
              <li><Link to="/rewards">Rewards</Link></li>
              <li><Link to="/nftshop">NFT Shop</Link></li>
            </ul>
          </nav>
      )}
    </div>
  );
};

export default HomePage;