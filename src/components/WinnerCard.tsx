import React, { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { AXEP_VOTING_CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI } from 'config';
import { Button, TextField, Box, Typography, CircularProgress, Link as MuiLink, Alert } from '@mui/material';

// Define the structure of the Track and Artist objects
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
    const [shareUrl, setShareUrl] = useState('');

    const { data: hash, error, isPending, writeContract } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = 
        useWaitForTransactionReceipt({ 
          hash, 
        })

    const handleSubmitProof = async () => {
        if (!shareUrl) {
            alert("Please enter the URL of your share.");
            return;
        }

        writeContract({
            address: AXEP_VOTING_CONTRACT_ADDRESS as `0x${string}`,
            abi: AXEP_VOTING_CONTRACT_ABI,
            functionName: 'recordShare',
            args: [track.id, shareUrl],
        });
    };
    
    // Social Sharing Links
    const shareTitle = `Check out this track "${track.title}" by ${artist.name}! Vote for them on Axep.`;
    const sharePageUrl = window.location.href; 
    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(sharePageUrl)}`;
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(sharePageUrl)}`;


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
            <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center' }}>
                🏆 Current Winner 🏆
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: 3 }}>
                <Box 
                    component="img"
                    src={track.coverImageUrl}
                    alt={`${track.title} cover`}
                    sx={{
                        width: 150,
                        height: 150,
                        borderRadius: '10px',
                        objectFit: 'cover',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                    }}
                />
                <Box>
                    <Typography variant="h5" component="p" sx={{ fontWeight: 'bold' }}>{track.title}</Typography>
                    <Typography variant="h6" component="p" sx={{ color: '#ccc', mb: 2 }}>by {artist.name}</Typography>
                    <Typography variant="body1" component="p">Votes: {track.votes.toString()}</Typography>
                </Box>
            </Box>

            <Box sx={{ mt: 4 }}>
                <Typography variant="h6" component="p" sx={{ mb: 2, textAlign: 'center' }}>
                    Share this track and earn AXP tokens!
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
                    <MuiLink href={twitterShareUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="contained" sx={{backgroundColor: '#1DA1F2'}}>Share on Twitter</Button>
                    </MuiLink>
                     <MuiLink href={facebookShareUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="contained" sx={{backgroundColor: '#1877F2'}}>Share on Facebook</Button>
                    </MuiLink>
                </Box>

                <Typography variant="body2" sx={{ textAlign: 'center', mb: 2, color: '#aaa' }}>
                    After sharing, paste the URL of your post below to claim your reward.
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        label="Paste your share URL here"
                        value={shareUrl}
                        onChange={(e) => setShareUrl(e.target.value)}
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
                        disabled={isPending || isConfirming || !shareUrl}
                        sx={{ height: '56px', width: '120px' }}
                    >
                        {isPending || isConfirming ? <CircularProgress size={24} color="inherit" /> : 'Submit'}
                    </Button>
                </Box>
                 {isConfirming && <Typography sx={{mt: 1, color: 'primary.main'}}>Waiting for confirmation...</Typography>}
                 {isConfirmed && <Alert severity="success" sx={{mt: 2}}>Success! Your share has been recorded. Rewards will be distributed by the admin.</Alert>}
                 {error && <Alert severity="error" sx={{mt: 2}}>Error: {error.message}</Alert>}

            </Box>
        </Box>
    );
};

export default WinnerCard; 