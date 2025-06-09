import React, { useState } from 'react';
import { Track } from '../types';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { AXEP_VOTING_CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI } from '../config';
import { Card, CardMedia, CardContent, CardActions, Typography, Button, CircularProgress, Link, Alert } from '@mui/material';

interface TrackCardProps {
    track: Track;
}

const TrackCard: React.FC<TrackCardProps> = ({ track }) => {
    const { address } = useAccount();
    const [voteError, setVoteError] = useState<string | null>(null);

    const { data: hash, writeContract, isPending: isVoting } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

    const handleVote = () => {
        if (!address) {
            setVoteError("Please connect your wallet to vote.");
            return;
        }
        if (!track.onChainTrackId) {
            setVoteError("This track does not have a valid on-chain ID and cannot be voted for.");
            return;
        }
        setVoteError(null);
        writeContract({
            address: AXEP_VOTING_CONTRACT_ADDRESS,
            abi: AXEP_VOTING_CONTRACT_ABI,
            functionName: 'voteForTrack',
            args: [BigInt(track.onChainTrackId)],
        });
    };

    return (
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardMedia
                component="img"
                height="200"
                image={track.coverImageUrl}
                alt={`Cover for ${track.trackTitle}`}
            />
            <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h5" component="h2">
                    {track.trackTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    By: {track.artistName}
                </Typography>
                 <Typography variant="body2" color="text.secondary">
                    Genre: {track.genre}
                </Typography>
                <Link href={track.videoUrl} target="_blank" rel="noopener noreferrer" sx={{ mt: 1, display: 'block' }}>
                    Listen/View on IPFS
                </Link>
            </CardContent>
            <CardActions sx={{ p: 2 }}>
                <Button 
                    fullWidth
                    size="large"
                    variant="contained"
                    onClick={handleVote}
                    disabled={isVoting || isConfirming || !address}
                >
                    {isVoting || isConfirming ? <CircularProgress size={24} color="inherit" /> : 'Vote For This Track'}
                </Button>
            </CardActions>
            {isConfirmed && (
                <Alert severity="success" sx={{ m: 2, mt: 0 }}>Vote cast successfully!</Alert>
            )}
            {voteError && (
                 <Alert severity="warning" sx={{ m: 2, mt: 0 }}>{voteError}</Alert>
            )}
        </Card>
    );
};

export default TrackCard; 