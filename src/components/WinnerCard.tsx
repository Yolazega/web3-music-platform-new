import React, { useState } from 'react';
import { Box, Typography, TextField, Button, CircularProgress, Alert, IconButton, Stack } from '@mui/material';
import TwitterIcon from '@mui/icons-material/Twitter';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import { useWriteContract, useAccount } from 'wagmi';
import { Track } from '../types';
import api from '../services/api';

interface WinnerCardProps {
    winner: Track;
}

const WinnerCard: React.FC<WinnerCardProps> = ({ winner }) => {
    const { address } = useAccount();
    const { data: hash, error, isPending, writeContract } = useWriteContract();
    const [showSubmitForm, setShowSubmitForm] = useState(false);
    const [shareUrls, setShareUrls] = useState({ url1: '', url2: '' });

    const handleShareClick = (platform: 'X' | 'Facebook' | 'Instagram') => {
        // Instagram has no web share intent, so we handle it separately.
        if (platform === 'Instagram') {
            alert("To share on Instagram, please create a post in their mobile app. Afterwards, copy the post's link and paste it in the form below.");
            setShowSubmitForm(true);
            return;
        }

        const trackUrl = window.location.origin; // URL of the Axep site
        const shareText = `Check out the winning track "${winner.title}" by ${winner.artist} on Axep! #AxepVoting`;
        const encodedUrl = encodeURIComponent(trackUrl);

        let shareLink = '';

        if (platform === 'X') {
            const encodedText = encodeURIComponent(shareText);
            shareLink = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        } else if (platform === 'Facebook') {
            const quote = shareText;
            shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodeURIComponent(quote)}`;
        }

        if (shareLink) {
            window.open(shareLink, '_blank', 'noopener,noreferrer');
        }

        setShowSubmitForm(true);
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setShareUrls(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmitProof = async () => {
        if (!address || !winner.onChainId) {
            alert('Please connect your wallet or ensure winner data is available.');
            return;
        }

        try {
            await api.post('/shares/record', {
                userWallet: address,
                trackId: winner.onChainId,
                shareUrl1: shareUrls.url1,
                shareUrl2: shareUrls.url2,
            });
            alert('Your submission has been recorded! It will be reviewed for rewards.');
            setShowSubmitForm(false);
        } catch (error) {
            console.error('Failed to record share submission:', error);
            alert('There was an error submitting your proof. Please try again.');
        }
    };

    return (
        <Box sx={{
            background: 'linear-gradient(45deg, #FF8E53, #FFD700)',
            p: 4,
            borderRadius: 4,
            color: 'white',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            maxWidth: 600,
            mx: 'auto',
            mt: 4
        }}>
            <Typography variant="h4" gutterBottom>
                🏆 Weekly Winner! 🏆
            </Typography>
            <Typography variant="h5" component="div">
                {winner.title}
            </Typography>
            <Typography variant="h6" sx={{ mb: 3 }}>
                by {winner.artist}
            </Typography>

            {/* Share Section */}
            <Box sx={{ border: '2px solid white', borderRadius: 2, p: 2, mb: 2 }}>
                <Typography variant="body1" sx={{ textAlign: 'center', mb: 2 }}>
                    Share the winning track to earn rewards!
                </Typography>
                <Stack direction="row" spacing={2} justifyContent="center">
                    <IconButton onClick={() => handleShareClick('X')} sx={{ color: 'white' }}>
                        <TwitterIcon />
                    </IconButton>
                    <IconButton onClick={() => handleShareClick('Facebook')} sx={{ color: 'white' }}>
                        <FacebookIcon />
                    </IconButton>
                    <IconButton onClick={() => handleShareClick('Instagram')} sx={{ color: 'white' }}>
                        <InstagramIcon />
                    </IconButton>
                </Stack>
            </Box>
            
            <Typography variant="body2" sx={{ textAlign: 'center', mb: 2, color: '#eee' }}>
                After sharing, click the icon again. Then find your post on the social platform, click its timestamp to get the direct URL, and paste it below.
            </Typography>

            {showSubmitForm && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                    <TextField
                        label="Share URL 1"
                        variant="filled"
                        name="url1"
                        value={shareUrls.url1}
                        onChange={handleUrlChange}
                        fullWidth
                        sx={{ input: { color: 'black' }, fieldset: { borderColor: 'white' }, '& .MuiFilledInput-root': { backgroundColor: 'rgba(255, 255, 255, 0.9)' } }}
                    />
                    <TextField
                        label="Share URL 2"
                        variant="filled"
                        name="url2"
                        value={shareUrls.url2}
                        onChange={handleUrlChange}
                        fullWidth
                         sx={{ input: { color: 'black' }, fieldset: { borderColor: 'white' }, '& .MuiFilledInput-root': { backgroundColor: 'rgba(255, 255, 255, 0.9)' } }}
                    />
                    <Button
                        variant="contained"
                        onClick={handleSubmitProof}
                        disabled={isPending || !shareUrls.url1 || !shareUrls.url2}
                        sx={{ 
                            backgroundColor: 'white', 
                            color: '#FF8E53', 
                            '&:hover': { backgroundColor: '#f0f0f0' }
                        }}
                    >
                        {isPending ? <CircularProgress size={24} /> : 'Submit Proof'}
                    </Button>
                </Box>
            )}

            {hash && <Alert severity="success" sx={{ mt: 2 }}>Proof submitted successfully! Tx: {hash}</Alert>}
            {error && <Alert severity="error" sx={{ mt: 2 }}>Error: {error.message}</Alert>}
        </Box>
    );
};

export default WinnerCard; 