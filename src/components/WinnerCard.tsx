import React, { useState } from 'react';
import { Box, Typography, TextField, Button, CircularProgress, Alert, IconButton } from '@mui/material';
import { Twitter, Facebook, Instagram } from '@mui/icons-material'; // Using placeholder icons
import { AXEP_VOTING_CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI } from '../config';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Track } from '../types';

// Define WinnerCardProps using the imported Track type
interface WinnerCardProps {
    track: Track;
    artist: { name: string }; // Keep this simple for now
}

const WinnerCard: React.FC<WinnerCardProps> = ({ track, artist }) => {
    const [shareUrl1, setShareUrl1] = useState('');
    const [shareUrl2, setShareUrl2] = useState('');
    const [showSubmitForm, setShowSubmitForm] = useState(false);

    const { data: hash, error, isPending, writeContract } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = 
        useWaitForTransactionReceipt({ 
          hash, 
        })

    const handleSubmitProof = async () => {
        if (!shareUrl1 || !shareUrl2) {
            alert("Please enter both share URLs.");
            return;
        }
        // Here, you would call your backend API to submit both links for verification
        // Example: await api.post('/shares', { trackId: track.id, shareUrl1, shareUrl2 });
        // For now, just call the contract's recordShare with the first link (for demo)
        writeContract({
            address: AXEP_VOTING_CONTRACT_ADDRESS as `0x${string}`,
            abi: AXEP_VOTING_CONTRACT_ABI,
            functionName: 'recordShare',
            args: [BigInt(track.id), shareUrl1, shareUrl2],
        });
    };

    return (
        <Box sx={{ 
            width: '100%', 
            maxWidth: '800px', 
            background: 'linear-gradient(145deg, #2c2c2c, #1a1a1a)',
            borderRadius: '15px', 
            p: 4, 
            color: 'white',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
        }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, textAlign: 'center' }}>Current Main Winner</Typography>
            <Typography variant="h6" sx={{ textAlign: 'center' }}>{artist.name} - "{track.title}"</Typography>
            <Typography sx={{ textAlign: 'center' }}>Votes: {track.votes.toLocaleString()}</Typography>

            <Box sx={{ mt: 4 }}>
                <Typography variant="h6" component="p" sx={{ mb: 2, textAlign: 'center' }}>
                    Share this track and earn AXP tokens!
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
                    <IconButton onClick={() => setShowSubmitForm(true)} sx={{ color: 'white' }}><Twitter /></IconButton>
                    <IconButton onClick={() => setShowSubmitForm(true)} sx={{ color: 'white' }}><Facebook /></IconButton>
                    <IconButton onClick={() => setShowSubmitForm(true)} sx={{ color: 'white' }}><Instagram /></IconButton>
                </Box>
                
                <Typography variant="body2" sx={{ textAlign: 'center', mb: 2, color: '#aaa' }}>
                    After sharing, click an icon and paste the URLs of your two posts below.
                </Typography>

                {showSubmitForm && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                        <TextField
                            label="Share URL 1"
                            variant="filled"
                            value={shareUrl1}
                            onChange={(e) => setShareUrl1(e.target.value)}
                            fullWidth
                            sx={{ input: { color: 'white' }, label: { color: 'gray' } }}
                        />
                        <TextField
                            label="Share URL 2"
                            variant="filled"
                            value={shareUrl2}
                            onChange={(e) => setShareUrl2(e.target.value)}
                            fullWidth
                            sx={{ input: { color: 'white' }, label: { color: 'gray' } }}
                        />
                        <Button
                            onClick={handleSubmitProof}
                            disabled={isPending || isConfirming}
                            variant="contained"
                            color="primary"
                        >
                            {isPending ? 'Check Wallet...' : isConfirming ? 'Confirming...' : 'Submit Proof'}
                        </Button>
                    </Box>
                )}
                
                {isConfirmed && <Alert severity="success" sx={{ mt: 2 }}>Proof submitted successfully!</Alert>}
                {error && <Alert severity="error" sx={{ mt: 2 }}>Error: {error.message}</Alert>}
            </Box>
        </Box>
    );
}

export default WinnerCard; 