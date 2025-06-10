import React, { useState } from 'react';
import { Track } from '../types';
import { useReadContract } from 'wagmi';
import { AXEP_VOTING_CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI } from '../config';
import api from '../services/api';
import { Card, CardMedia, CardContent, CardActions, Typography, Button, CircularProgress, Link, Box, Alert, Snackbar } from '@mui/material';

interface TrackCardProps {
    track: Track;
}

const TrackCard: React.FC<TrackCardProps> = ({ track }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const { data: voteCount, isLoading: isVoteCountLoading, refetch: refetchVoteCount } = useReadContract({
        address: AXEP_VOTING_CONTRACT_ADDRESS,
        abi: AXEP_VOTING_CONTRACT_ABI,
        functionName: 'getVoteCount',
        args: [BigInt(track.onChainTrackId || 0)],
    });

    const handleVote = async () => {
        if (!track.onChainTrackId) {
            setFeedback({ type: 'error', message: "This track has no on-chain ID." });
            return;
        }
        setIsSubmitting(true);
        try {
            await api.post('/votes', { onChainTrackId: track.onChainTrackId });
            setFeedback({ type: 'success', message: 'Your vote was recorded successfully!' });
            // Optionally, we can refetch the vote count after a delay or a certain event
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || "An unknown error occurred.";
            setFeedback({ type: 'error', message: `Failed to vote: ${errorMessage}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseSnackbar = () => {
        setFeedback(null);
    };

    return (
        <>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
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
                        Watch Video
                    </Link>
                </CardContent>
                <CardActions sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                    <Button 
                        size="large"
                        variant="contained"
                        onClick={handleVote}
                        disabled={isSubmitting}
                        sx={{ flexGrow: 1, mr: 2 }}
                    >
                        {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Vote Now'}
                    </Button>
                    <Box sx={{ textAlign: 'center', minWidth: '50px' }}>
                        <Typography variant="h6" component="p">
                            {isVoteCountLoading ? <CircularProgress size={20} /> : voteCount?.toString() || '0'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Votes
                        </Typography>
                    </Box>
                </CardActions>
            </Card>
            <Snackbar open={!!feedback} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={handleCloseSnackbar} severity={feedback?.type} sx={{ width: '100%' }}>
                    {feedback?.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default TrackCard; 