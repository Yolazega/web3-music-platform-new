import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useBalance, useReadContracts } from 'wagmi';
import { AXP_TOKEN_CONTRACT_ADDRESS, AMOY_CHAIN_ID, AXEP_VOTING_CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI } from 'config';
import WinnerCard from './WinnerCard';
import { Box, Typography, CircularProgress, Alert, Container, Grid, Card, CardContent } from '@mui/material';
import { Abi } from 'viem';

// This defines the shape of a single contract call for wagmi's useReadContracts
interface ContractReadCall {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

const HomePage: React.FC = () => {
  const { address, chain } = useAccount();
  const { data: axpBalance } = useBalance({
    address,
    token: AXP_TOKEN_CONTRACT_ADDRESS as `0x${string}`,
  });

  const axepVotingContract = {
    address: AXEP_VOTING_CONTRACT_ADDRESS as `0x${string}`,
    abi: AXEP_VOTING_CONTRACT_ABI,
  };

  const { data: trackIds, isLoading: isLoadingTrackIds, error: errorTrackIds } = useReadContracts({
    contracts: [{ ...axepVotingContract, functionName: 'getAllTrackIds' }],
    // query: { enabled: !!address },
  });
  
  const allTrackIds = trackIds?.[0]?.result as bigint[] | undefined;

  const { data: tracksData, isLoading: isLoadingTracks, error: errorTracks } = useReadContracts({
      contracts: allTrackIds?.map(id => ({
          ...axepVotingContract,
          functionName: 'getTrack',
          args: [id],
      })) || [],
      query: { enabled: !!allTrackIds && allTrackIds.length > 0 },
  });

  const tracks = tracksData?.map(t => t.result) || [];

  const winner = tracks.reduce((prev, current) => (prev.votes > current.votes) ? prev : current);

  const { data: artistData, isLoading: isLoadingArtist, error: errorArtist } = useReadContracts({
      contracts: winner ? [{
          ...axepVotingContract,
          functionName: 'getArtist',
          // @ts-ignore
          args: [winner.artistId],
      }] : [],
      query: { enabled: !!winner },
  });
  
  // @ts-ignore
  const winningArtist = artistData?.[0]?.result;

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
    backgroundColor: '#f4f6f8',
  };

  const genreBarStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: '900px',
    margin: '20px 0 40px 0',
    padding: '10px 0',
    borderBottom: '1px solid #ddd',
    flexWrap: 'wrap',
    gap: '10px'
  };

  const genreItemStyle: React.CSSProperties = {
    padding: '8px 16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    borderRadius: '20px',
    backgroundColor: '#e9ecef',
    transition: 'background-color 0.3s',
  };

  const heroSectionStyle: React.CSSProperties = {
    margin: '40px 0',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '4em',
    fontWeight: 'bold',
    letterSpacing: '0.1em',
    margin: '0',
    color: '#1a237e'
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
    display: 'flex',
    justifyContent: 'center',
    padding: '20px'
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

  // State to hold the formatted results from the contract reads
  const [stats, setStats] = useState<{
    balanceOf?: string;
    getAirdropAmount?: string;
    getWinnerCount?: string;
  }>({});

  // The array of contract calls we want to make
  const contracts: readonly ContractReadCall[] = address ? [
    {
      address: AXEP_VOTING_CONTRACT_ADDRESS,
      abi: AXEP_VOTING_CONTRACT_ABI,
      functionName: 'balanceOf',
      args: [address]
    },
    {
      address: AXEP_VOTING_CONTRACT_ADDRESS,
      abi: AXEP_VOTING_CONTRACT_ABI,
      functionName: 'getAirdropAmount',
      args: [address]
    },
    {
      address: AXEP_VOTING_CONTRACT_ADDRESS,
      abi: AXEP_VOTING_CONTRACT_ABI,
      functionName: 'getWinnerCount',
      args: [address]
    },
  ] : [];

  // The wagmi hook to read from the contracts
  const { data: contractData, isLoading: isLoadingContractData, isError, error: contractError } = useReadContracts({
    contracts, // This is now correctly typed
    query: {
      enabled: address && !!address, // Only run query if connected
      refetchInterval: 15000, // Refetch every 15 seconds
    }
  });

  // Helper function to format bigint values from the contract
  const formatBigInt = (value?: unknown): string => {
    if (typeof value !== 'bigint') return 'N/A';
    // A simple formatting for 18 decimal places
    const number = Number(value) / 1e18;
    return number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  // Effect to process the data when it comes back from the hook
  useEffect(() => {
    if (contractData) {
      setStats({
        balanceOf: formatBigInt(contractData[0]?.result),
        getAirdropAmount: formatBigInt(contractData[1]?.result),
        getWinnerCount: typeof contractData[2]?.result === 'bigint' ? contractData[2].result.toString() : 'N/A',
      });
    }
  }, [contractData]);

  const renderWinnerSection = () => {
    if (isLoadingTrackIds || isLoadingTracks || isLoadingArtist) {
      return <CircularProgress />;
    }
    if (errorTrackIds || errorTracks || errorArtist) {
      return <Alert severity="error">Error loading winner data. Please try again later.</Alert>;
    }
    if (winner && winningArtist) {
      // @ts-ignore
      return <WinnerCard track={winner} artist={winningArtist} />;
    }
    return <Typography>No winner declared yet. Be the first to vote!</Typography>;
  }

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
          {renderWinnerSection()}
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

      {isLoadingContractData && <CircularProgress />}
      
      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Error fetching contract data: {contractError?.shortMessage || 'An unknown error occurred.'}
        </Alert>
      )}

      {!address && (
        <Alert severity="info">Please connect your wallet to view your dashboard.</Alert>
      )}

      {address && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Your AXP Balance
                </Typography>
                <Typography variant="h5" component="div">
                  {stats.balanceOf ?? '...'} AXP
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Claimable Airdrop
                </Typography>
                <Typography variant="h5" component="div">
                  {stats.getAirdropAmount ?? '...'} AXP
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Your Winning Tracks
                </Typography>
                <Typography variant="h5" component="div">
                  {stats.getWinnerCount ?? '...'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </div>
  );
};

export default HomePage;