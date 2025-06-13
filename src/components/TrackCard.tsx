import React, { useState } from 'react';
import { Track } from '../types';
import api from '../services/api';
import { Card, CardMedia, CardContent, CardActions, Typography, Button, CircularProgress, Link, Box, Alert, Snackbar } from '@mui/material';

interface TrackCardProps {
    track: Track;
}

const TrackCard: React.FC<TrackCardProps> = ({ track }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [voteCount, setVoteCount] = useState<number>(track.votes);

    const handleVote = async () => {
        setIsSubmitting(true);
        try {
            // The backend now expects the database track ID and the voter's address.
            // For this public-facing component, we'll assume the backend identifies the voter
            // via other means (e.g., IP address, session).
            // We just need to send the track's database ID.
            await api.post('/vote', { trackId: track.id });
            setFeedback({ type: 'success', message: 'Your vote was recorded successfully!' });
            // Optimistically update the vote count on the frontend.
            setVoteCount(currentCount => currentCount + 1);
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
                    alt={`Cover for ${track.title}`}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                    <Typography gutterBottom variant="h5" component="h2">
                        {track.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        By: {track.artist}
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
                            {voteCount}
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