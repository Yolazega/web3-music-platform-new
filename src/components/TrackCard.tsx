import React, { useState } from 'react';
import { Track } from '../types';
import api from '../services/api';
import { Card, CardMedia, CardContent, CardActions, Typography, Button, CircularProgress, Link, Box, Alert, Snackbar } from '@mui/material';
import { useAccount } from 'wagmi';

interface TrackCardProps {
    track: Track;
}

const TrackCard: React.FC<TrackCardProps> = ({ track }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [voteCount, setVoteCount] = useState<number>(track.votes);
    const [imageError, setImageError] = useState(false);
    const { address, isConnected } = useAccount();

    const handleVote = async () => {
        if (!isConnected || !address) {
            setFeedback({ type: 'error', message: 'Please connect your wallet to vote.' });
            return;
        }
        setIsSubmitting(true);
        setFeedback(null);
        try {
            // The backend now expects the database track ID and the voter's address.
            await api.post('/vote', { trackId: track.id, voterAddress: address });
            setFeedback({ type: 'success', message: 'Your vote was recorded successfully!' });
            // Optimistically update the vote count on the frontend.
            setVoteCount(currentCount => currentCount + 1);
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.message || 'An unknown error occurred.';
            setFeedback({ type: 'error', message: `Failed to vote: ${errorMessage}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseSnackbar = () => {
        setFeedback(null);
    };

    const handleImageError = () => {
        setImageError(true);
    };

    // Determine the image source with fallback
    const imageSrc = imageError || !track.coverImageUrl 
        ? 'https://placehold.co/400x200/333/fff?text=No+Image' 
        : track.coverImageUrl;

    return (
        <>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <CardMedia
                    component="img"
                    height="200"
                    image={imageSrc}
                    alt={`Cover for ${track.title}`}
                    onError={handleImageError}
                    sx={{
                        objectFit: 'cover',
                        backgroundColor: '#f5f5f5'
                    }}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                    <Typography gutterBottom variant="h5" component="h2">
                        {track.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        By: {track.artist}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Genre: {track.genre}
                    </Typography>
                    {track.videoUrl ? (
                        <Link href={track.videoUrl} target="_blank" rel="noopener noreferrer" sx={{ mt: 1, display: 'block' }}>
                            🎵 Watch Video
                        </Link>
                    ) : (
                        <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                            Video not available
                        </Typography>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                        <Button 
                            variant="contained" 
                            color="primary" 
                            onClick={handleVote} 
                            disabled={isSubmitting || !isConnected}
                            sx={{
                                transition: 'background-color 0.3s',
                                '&:hover': {
                                    backgroundColor: 'secondary.main',
                                },
                            }}
                        >
                            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Vote Now'}
                        </Button>
                        <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="h6">{voteCount}</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Votes
                            </Typography>
                        </Box>
                    </Box>
                </CardContent>
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