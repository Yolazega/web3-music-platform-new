import React, { useState, useEffect } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { Card, CardContent, Container, Typography, Grid, CircularProgress, Alert } from '@mui/material';
import { AXEP_VOTING_CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI } from '../config';
import { Abi } from 'viem';

// This defines the shape of a single contract call for wagmi's useReadContracts
interface ContractReadCall {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

const HomePage: React.FC = () => {
    const { address: accountAddress, isConnected } = useAccount();
    
    // State to hold the formatted results from the contract reads
    const [stats, setStats] = useState<{
        balanceOf?: string;
        getAirdropAmount?: string;
        getWinnerCount?: string;
    }>({});

    // The array of contract calls we want to make
    const contracts: readonly ContractReadCall[] = isConnected && accountAddress ? [
        {
            address: AXEP_VOTING_CONTRACT_ADDRESS,
            abi: AXEP_VOTING_CONTRACT_ABI,
            functionName: 'balanceOf',
            args: [accountAddress]
        },
        {
            address: AXEP_VOTING_CONTRACT_ADDRESS,
            abi: AXEP_VOTING_CONTRACT_ABI,
            functionName: 'getAirdropAmount',
            args: [accountAddress]
        },
        {
            address: AXEP_VOTING_CONTRACT_ADDRESS,
            abi: AXEP_VOTING_CONTRACT_ABI,
            functionName: 'getWinnerCount',
            args: [accountAddress]
        },
    ] : [];

    // The wagmi hook to read from the contracts
    const { data: contractData, isLoading, isError, error } = useReadContracts({
        contracts, // This is now correctly typed
        query: {
            enabled: isConnected && !!accountAddress, // Only run query if connected
            refetchInterval: 15000, // Refetch every 15 seconds
        }
    });

    // Helper function to format bigint values from the contract
    const formatBigInt = (value?: unknown): string => {
        if (typeof value !== 'bigint') return '...';
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
                getWinnerCount: typeof contractData[2]?.result === 'bigint' ? contractData[2].result.toString() : '...',
            });
        }
    }, [contractData]);

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Welcome to the AXEP Music Platform
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
                Discover, vote, and get rewarded. Connect your wallet to see your personal dashboard.
            </Typography>
            
            {isError && (
                 <Alert severity="error" sx={{ mb: 2 }}>
                    Error fetching your on-chain data: {error?.message || 'An unknown error occurred.'}
                 </Alert>
            )}

            {!isConnected ? (
                <Alert severity="info">Please connect your wallet to view your dashboard.</Alert>
            ) : isLoading ? (
                <Grid container justifyContent="center"><CircularProgress /></Grid>
            ) : (
                <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                        <Card>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom>
                                    Your AXP Balance
                                </Typography>
                                <Typography variant="h5" component="div">
                                    {stats.balanceOf} AXP
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
                                    {stats.getAirdropAmount} AXP
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
                                    {stats.getWinnerCount}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}
        </Container>
    );
};

export default HomePage;
