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
    const [videoError, setVideoError] = useState(false);
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

    const handleVideoClick = (e: React.MouseEvent) => {
        if (!track.videoUrl || videoError) {
            e.preventDefault();
            setFeedback({ type: 'error', message: 'Video is currently unavailable. Please try again later.' });
            return;
        }
        
        // Test if the video URL is accessible
        fetch(track.videoUrl, { method: 'HEAD' })
            .catch(() => {
                setVideoError(true);
                setFeedback({ type: 'error', message: 'Video content is currently unavailable.' });
            });
    };

    // Determine the image source with fallback
    const imageSrc = imageError || !track.coverImageUrl 
        ? 'https://placehold.co/400x200/333/fff?text=No+Image' 
        : track.coverImageUrl;

    // Check if IPFS URLs are potentially broken (empty hash or known broken hash)
    const isPotentiallyBrokenIPFS = (url: string) => {
        return url && (
            url.includes('QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH') || // Known broken hash
            url.length < 50 // Suspiciously short IPFS URL
        );
    };

    const isImageBroken = isPotentiallyBrokenIPFS(track.coverImageUrl || '');
    const isVideoBroken = isPotentiallyBrokenIPFS(track.videoUrl || '') || videoError;

    return (
        <>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {isImageBroken && (
                    <Box sx={{ 
                        position: 'absolute', 
                        top: 8, 
                        right: 8, 
                        zIndex: 1,
                        backgroundColor: 'rgba(255, 152, 0, 0.9)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem'
                    }}>
                        Image Loading Issue
                    </Box>
                )}
                <CardMedia
                    component="img"
                    height="200"
                    image={imageSrc}
                    alt={`Cover for ${track.title}`}
                    onError={handleImageError}
                    sx={{
                        objectFit: 'cover',
                        backgroundColor: '#f5f5f5',
                        opacity: isImageBroken ? 0.7 : 1
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
                    
                    {/* Video Section */}
                    <Box sx={{ mt: 1 }}>
                        {track.videoUrl && !isVideoBroken ? (
                            <Link 
                                href={track.videoUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                onClick={handleVideoClick}
                                sx={{ display: 'block', textDecoration: 'none' }}
                            >
                                🎵 Watch Video
                            </Link>
                        ) : track.videoUrl && isVideoBroken ? (
                            <Box sx={{ 
                                color: 'orange', 
                                fontSize: '0.875rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                            }}>
                                ⚠️ Video temporarily unavailable
                                <Button 
                                    size="small" 
                                    onClick={() => window.open(track.videoUrl, '_blank')}
                                    sx={{ fontSize: '0.75rem', minWidth: 'auto', padding: '2px 8px' }}
                                >
                                    Try Direct Link
                                </Button>
                            </Box>
                        ) : (
                            <Typography variant="body2" color="text.disabled">
                                Video not available
                            </Typography>
                        )}
                    </Box>

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