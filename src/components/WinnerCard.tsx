import React, { useState } from 'react';
import { Box, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';
import { AXEP_VOTING_CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI } from '../config';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

// Define WinnerCardProps if not already defined
interface Artist {
    name: string;
}
interface Track {
    id: bigint;
    artistId: bigint;
    title: string;
    coverImageUrl: string;
    votes: bigint;
}
interface WinnerCardProps {
    track: Track;
    artist: Artist;
}

const WinnerCard: React.FC<WinnerCardProps> = ({ track, artist }) => {
    const [shareUrl1, setShareUrl1] = useState('');
    const [shareUrl2, setShareUrl2] = useState('');

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
            args: [track.id, shareUrl1, shareUrl2],
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
            {/* ... existing winner display ... */}
            <Box sx={{ mt: 4 }}>
                <Typography variant="h6" component="p" sx={{ mb: 2, textAlign: 'center' }}>
                    Share this track and earn AXP tokens!
                </Typography>
                {/* ... existing social share buttons ... */}
                <Typography variant="body2" sx={{ textAlign: 'center', mb: 2, color: '#aaa' }}>
                    After sharing, paste the URLs of your two posts below to claim your reward. Both must include #AxepVoting.
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        label="Share Link 1"
                        value={shareUrl1}
                        onChange={(e) => setShareUrl1(e.target.value)}
                        disabled={isPending || isConfirming}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: 'gray' },
                                '&:hover fieldset': { borderColor: 'white' },
                                '&.Mui-focused fieldset': { borderColor: 'white' },
                            },
                            '& .MuiInputLabel-root': { color: 'gray' },
                        }}
                        InputProps={{ style: { color: 'white' } }}
                    />
                    <TextField
                        fullWidth
                        variant="outlined"
                        label="Share Link 2"
                        value={shareUrl2}
                        onChange={(e) => setShareUrl2(e.target.value)}
                        disabled={isPending || isConfirming}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: 'gray' },
                                '&:hover fieldset': { borderColor: 'white' },
                                '&.Mui-focused fieldset': { borderColor: 'white' },
                            },
                            '& .MuiInputLabel-root': { color: 'gray' },
                        }}
                        InputProps={{ style: { color: 'white' } }}
                    />
                    <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={handleSubmitProof} 
                        disabled={isPending || isConfirming || !shareUrl1 || !shareUrl2}
                        sx={{ height: '56px', width: '120px', alignSelf: 'center' }}
                    >
                        {isPending || isConfirming ? <CircularProgress size={24} color="inherit" /> : 'Submit'}
                    </Button>
                </Box>
                {isConfirming && <Typography sx={{mt: 1, color: 'primary.main'}}>Waiting for confirmation...</Typography>}
                {isConfirmed && <Alert severity="success" sx={{mt: 2}}>Success! Your shares have been recorded. Rewards will be distributed by the admin.</Alert>}
                {error && <Alert severity="error" sx={{mt: 2}}>Error: {error.message}</Alert>}
            </Box>
        </Box>
    );
}

export default WinnerCard; 