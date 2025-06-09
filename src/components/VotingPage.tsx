import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { AXEP_VOTING_CONTRACT_ADDRESS, AMOY_CHAIN_ID } from '../config';
import { axepVotingAbi } from '../contracts/contract';
import api from '../services/api';
import { Track } from '../types'; // Using the correct backend Track type
import {
    Container, 
    Typography,
    Card,
    CardContent,
    CardMedia,
    Button,
    Grid,
    CircularProgress,
    Alert,
    Box,
    Link
} from '@mui/material';

const VotingPage: React.FC = () => {
    const { address, chain } = useAccount();
    const { data: hash, writeContract, isPending: isVoting, error: writeError } = useWriteContract();

    const [tracks, setTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [sharedTracks, setSharedTracks] = useState<Set<string>>(new Set());
    const [reportedTracks, setReportedTracks] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchTracks = async () => {
            setLoading(true);
            try {
                // Fetch only tracks that are published and ready for voting
                const response = await api.get('/submissions?status=published');
                const tracksData = response.data?.tracks ?? [];
                setTracks(tracksData);
            } catch (err) {
                console.error('Failed to fetch tracks:', err);
                setError('Failed to fetch tracks. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchTracks();
    }, []);

    const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } = useWaitForTransactionReceipt({ hash });

    const isConnectedOnAmoy = address && chain && chain.id.toString() === parseInt(AMOY_CHAIN_ID, 16).toString();

    const handleVote = (trackId: string) => {
        // The contract might still expect a number/bigint, ensure this is handled.
        // For now, assuming the contract can handle the string ID or it needs conversion.
        writeContract({
            address: AXEP_VOTING_CONTRACT_ADDRESS,
            abi: axepVotingAbi,
            functionName: 'voteForTrack',
            args: [trackId], // This might need `BigInt(trackId)` if contract expects bigint
        });
    };
    
    const handleReport = async (trackId: string) => {
        if (window.confirm('Are you sure you want to report this track? This action cannot be undone.')) {
            try {
                await api.post(`/submissions/${trackId}/report`);
                alert('Track reported successfully. Thank you for your feedback.');
                setReportedTracks(prev => new Set(prev).add(trackId));
            } catch (err) {
                console.error('Failed to report track:', err);
                setError('Failed to report track. Please try again later.');
            }
        }
    };

    const handleShare = async (trackId: string) => {
        if (!address) return; // Should not happen if button is visible
        try {
            await api.post('/shares', { walletAddress: address, trackId });
            setSharedTracks(prev => new Set(prev).add(trackId));
            // Maybe show a small success message
        } catch (err) {
            console.error('Failed to record share:', err);
            // Optionally notify the user that sharing failed
        }
    };

    if (loading) return <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Container>;
    if (error) return <Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;
    if (!address) return <Container sx={{ mt: 4 }}><Alert severity="info">Please connect your wallet to view and vote for tracks.</Alert></Container>;
    if (!isConnectedOnAmoy) return <Container sx={{ mt: 4 }}><Alert severity="warning">Please switch to the Polygon Amoy Testnet to vote.</Alert></Container>;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>Vote for Your Favorite Tracks</Typography>
            <Typography variant="body1" sx={{ mb: 4 }}>Your vote helps artists gain visibility. Cast your vote for the tracks you love!</Typography>

            {(isVoting || isConfirming) && <Alert severity="info" sx={{ mb: 2 }}>{isConfirming ? 'Confirming your vote on the blockchain...' : 'Sending your vote to your wallet...'}</Alert>}
            {isConfirmed && <Alert severity="success" sx={{ mb: 2 }}>Vote successfully cast!</Alert>}
            {(writeError || receiptError) && <Alert severity="error" sx={{ mb: 2 }}>Error: {writeError?.message || receiptError?.message}</Alert>}
            
            {!loading && tracks.length === 0 && (
                <Alert severity="info">No tracks are currently available for voting. Check back soon!</Alert>
            )}

            <Grid container spacing={4}>
                {tracks.map(track => (
                    <Grid item key={track.id} xs={12} sm={6} md={4}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardMedia
                                component="img"
                                height="200"
                                image={track.coverImageUrl}
                                alt={`Cover for ${track.trackTitle}`}
                            />
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Typography gutterBottom variant="h5" component="div">
                                    {track.trackTitle}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    By {track.artistName} | Genre: {track.genre}
                                </Typography>
                                <Link href={track.videoUrl} target="_blank" rel="noopener noreferrer" sx={{ mt: 1, display: 'block' }}>
                                    Watch Video
                                </Link>
                            </CardContent>
                            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                                <Button 
                                    size="small"
                                    variant="contained"
                                    onClick={() => handleVote(track.id)}
                                    disabled={isVoting || isConfirming}
                                >
                                    Vote
                                </Button>
                                <Button
                                    size="small"
                                    variant={sharedTracks.has(track.id) ? "contained" : "outlined"}
                                    color="secondary"
                                    onClick={() => handleShare(track.id)}
                                    disabled={sharedTracks.has(track.id)}
                                >
                                    {sharedTracks.has(track.id) ? 'Shared!' : 'Share & Earn'}
                                </Button>
                                <Button
                                    size="small"
                                    color="error"
                                    onClick={() => handleReport(track.id)}
                                    disabled={reportedTracks.has(track.id)}
                                >
                                    {reportedTracks.has(track.id) ? 'Reported' : 'Report'}
                                </Button>
                            </Box>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Container>
    );
};

export default VotingPage;
