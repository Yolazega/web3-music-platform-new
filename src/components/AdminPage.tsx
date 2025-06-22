import React, { useState, useEffect, useCallback } from 'react';
import api, { wakeUpBackend, checkBackendHealth } from '../services/api';
import { Track, Share, Vote } from '../types';
import {
    Container, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button,
    CircularProgress, Card, CardContent, Grid, Alert, Box, Typography, Link, Snackbar
} from '@mui/material';
import { useWriteContract, useAccount, useConnections } from 'wagmi';
import { AXEP_VOTING_CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI, GAS_CONFIG, getGasConfig, isHardwareWallet } from '../config';
import { ethers } from 'ethers';
import { parseEventLogs } from 'viem';
import { readContract } from 'viem/actions';
import { publicClient, getOptimizedGasPrice } from '../client';

interface ShareSubmission {
    id: string;
    userWallet: string;
    trackId: number;
    shareUrl1: string;
    shareUrl2: string;
    status: 'pending' | 'verified' | 'rejected';
    submittedAt: string;
    track: {
        title: string;
        artist: string;
    }
}

// Using shared publicClient with fallback RPC configuration

const AdminPage: React.FC = () => {
    const [submissions, setSubmissions] = useState<Track[]>([]);
    const [shares, setShares] = useState<Share[]>([]);
    const [votes, setVotes] = useState<Vote[]>([]);
    const [shareSubmissions, setShareSubmissions] = useState<ShareSubmission[]>([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState<Track[]>([]);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'published'>('all');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isApproving, setIsApproving] = useState<Record<string, boolean>>({});
    const [isPublishing, setIsPublishing] = useState<boolean>(false);
    const [isTallying, setIsTallying] = useState<boolean>(false);
    const [isUpdatingShare, setIsUpdatingShare] = useState<Record<string, boolean>>({});
    const [snackbar, setSnackbar] = useState<{ open: boolean, message: string }>({ open: false, message: '' });
    const [isOwner, setIsOwner] = useState<boolean>(false);
    const [backendStatus, setBackendStatus] = useState<'checking' | 'awake' | 'waking' | 'error'>('checking');
    const [walletType, setWalletType] = useState<string>('');
    const [isUsingHardwareWallet, setIsUsingHardwareWallet] = useState<boolean>(false);

    const { writeContractAsync } = useWriteContract();
    const { address: userAddress } = useAccount();
    const connections = useConnections();

    // Detect if user is using a hardware wallet
    useEffect(() => {
        if (connections && connections.length > 0) {
            const activeConnection = connections[0];
            if (activeConnection?.connector?.name) {
                const walletName = activeConnection.connector.name;
                setWalletType(walletName);
                setIsUsingHardwareWallet(isHardwareWallet(walletName));
                console.log('Detected wallet:', walletName, 'Hardware wallet:', isHardwareWallet(walletName));
            }
        }
    }, [connections]);

    // Proactive backend wake-up on component mount
    useEffect(() => {
        const initializeBackend = async () => {
            setBackendStatus('checking');
            
            // Check if backend is already healthy
            const isHealthy = await checkBackendHealth();
            if (isHealthy) {
                setBackendStatus('awake');
                return;
            }
            
            // If not healthy, try to wake it up
            setBackendStatus('waking');
            const wakeupSuccess = await wakeUpBackend();
            if (wakeupSuccess) {
                // Wait a bit for backend to fully initialize
                await new Promise(resolve => setTimeout(resolve, 3000));
                setBackendStatus('awake');
            } else {
                setBackendStatus('error');
            }
        };
        
        initializeBackend();
    }, []);

    useEffect(() => {
        const checkOwner = async () => {
            try {
                const contractOwner = await readContract(publicClient, {
                    address: AXEP_VOTING_CONTRACT_ADDRESS,
                    abi: AXEP_VOTING_CONTRACT_ABI,
                    functionName: 'owner',
                    args: [],
                });

                if (userAddress && contractOwner && userAddress.toLowerCase() === (contractOwner as string).toLowerCase()) {
                    setIsOwner(true);
                } else {
                    setIsOwner(false);
                }
            } catch (error) {
                console.error("Error checking contract owner:", error);
                setIsOwner(false);
            }
        };

        if(userAddress) {
            checkOwner();
        } else {
            setIsOwner(false);
        }
    }, [userAddress]);

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Try the combined endpoint first for better performance
            try {
                console.log('Fetching admin dashboard data...');
                const dashboardRes = await api.get('/admin/dashboard');
                const { submissions, votes, shares } = dashboardRes.data;
                
                setSubmissions(submissions.sort((a: Track, b: Track) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
                setVotes(votes);
                setShareSubmissions(shares);
                console.log('Admin dashboard data loaded successfully');
                return;
            } catch (dashboardError) {
                console.warn('Dashboard endpoint failed, falling back to individual requests:', dashboardError);
            }
            
            // Fallback: Make requests sequentially to avoid overwhelming the server
            console.log('Fetching admin submissions...');
            const submissionsRes = await api.get('/admin/submissions');
            
            console.log('Fetching admin votes...');
            const votesRes = await api.get('/admin/votes');
            
            console.log('Fetching admin shares...');
            const shareSubmissionsRes = await api.get('/admin/shares');
            
            setSubmissions(submissionsRes.data.sort((a: Track, b: Track) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
            setVotes(votesRes.data);
            setShareSubmissions(shareSubmissionsRes.data);
            console.log('All admin data loaded successfully via individual requests');
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message || "Failed to load admin data";
            setError(`${errorMsg}. Please try again.`);
            console.error('Admin data fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Only fetch data when backend is confirmed awake
        if (backendStatus === 'awake') {
            fetchAllData();
        }
    }, [fetchAllData, backendStatus]);

    useEffect(() => {
        setFilteredSubmissions(filter === 'all' ? submissions : submissions.filter(s => s.status === filter));
    }, [filter, submissions]);
    
    const stats = React.useMemo(() => ({
        pending: submissions.filter(s => s.status === 'pending').length,
        approved: submissions.filter(s => s.status === 'approved' && !s.onChainId).length,
        published: submissions.filter(s => s.status === 'published').length,
        pendingShares: shareSubmissions.filter(s => s.status === 'pending').length,
        unprocessedVotes: votes.filter(v => v.status === 'unprocessed').length,
    }), [submissions, shareSubmissions, votes]);

    const handleApprove = async (id: string) => {
        setIsApproving(prev => ({...prev, [id]: true}));
        try {
            await api.patch(`/admin/submissions/${id}`, { status: 'approved' });
            setSnackbar({ open: true, message: 'Track approved successfully.' });
            fetchAllData();
        } catch (err) { 
            console.error(`Error approving submission ${id}:`, err);
            setSnackbar({ open: true, message: `Error approving submission.` });
        } finally {
            setIsApproving(prev => ({...prev, [id]: false}));
        }
    };

    const handleReject = async (id: string) => {
        setIsApproving(prev => ({...prev, [id]: true}));
        try {
            await api.patch(`/admin/submissions/${id}`, { status: 'rejected' });
            setSnackbar({ open: true, message: 'Track rejected successfully.' });
            fetchAllData();
        } catch (err) { 
            console.error(`Error rejecting submission ${id}:`, err);
            setSnackbar({ open: true, message: `Error rejecting submission.` });
        } finally {
            setIsApproving(prev => ({...prev, [id]: false}));
        }
    };

    const handleUpdateShareStatus = async (id: string, status: 'verified' | 'rejected') => {
        setIsUpdatingShare(prev => ({ ...prev, [id]: true }));
        try {
            await api.patch(`/admin/shares/${id}`, { status });
            setSnackbar({ open: true, message: `Share submission status updated to ${status}.` });
            fetchAllData();
        } catch (err) {
            console.error(`Error updating share ${id}`, err);
            setSnackbar({ open: true, message: `Failed to update share status.` });
        } finally {
            setIsUpdatingShare(prev => ({ ...prev, [id]: false }));
        }
    };
    
    const handlePublishAll = async () => {
        const tracksToPublish = submissions.filter(s => s.status === 'approved');

        if (tracksToPublish.length === 0) {
            setSnackbar({ open: true, message: 'No approved tracks to publish.' });
            return;
        }

        if (!window.confirm(`This will register ${tracksToPublish.length} approved track(s) on the blockchain. Continue?`)) {
            return;
        }
        setIsPublishing(true);
        setSnackbar({ open: true, message: "1/6: Preparing track data..." });

        try {
            // First, get the official genres from the contract
            setSnackbar({ open: true, message: "2/6: Validating genres against contract..." });
            
            const officialGenres = await publicClient.readContract({
                address: AXEP_VOTING_CONTRACT_ADDRESS,
                abi: AXEP_VOTING_CONTRACT_ABI,
                functionName: 'getOfficialGenres',
            }) as string[];

            console.log('Official genres from contract:', officialGenres);

            // Validate data before sending to contract
            const trackData = {
                artistWallets: tracksToPublish.map(t => t.artistWallet as `0x${string}`),
                artistNames: tracksToPublish.map(t => t.artist),
                trackTitles: tracksToPublish.map(t => t.title),
                genres: tracksToPublish.map(t => t.genre),
                videoUrls: tracksToPublish.map(t => t.videoUrl || ''),
                coverImageUrls: tracksToPublish.map(t => t.coverImageUrl || ''),
            };

            // COMPREHENSIVE DATA VALIDATION AND LOGGING
            console.log('=== DEBUGGING CONTRACT DATA ===');
            console.log('Track data to be sent to contract:', trackData);
            console.log('Number of tracks to publish:', tracksToPublish.length);
            
            // Log each track individually for debugging
            tracksToPublish.forEach((track, index) => {
                console.log(`Track ${index}:`, {
                    id: track.id,
                    artist: track.artist,
                    title: track.title,
                    genre: track.genre,
                    artistWallet: track.artistWallet,
                    videoUrl: track.videoUrl,
                    coverImageUrl: track.coverImageUrl,
                    status: track.status
                });
            });
            
            // Validate that all arrays have the same length
            const lengths = [
                trackData.artistWallets.length,
                trackData.artistNames.length,
                trackData.trackTitles.length,
                trackData.genres.length,
                trackData.videoUrls.length,
                trackData.coverImageUrls.length
            ];
            
            console.log('Array lengths:', lengths);
            if (new Set(lengths).size !== 1) {
                throw new Error(`Array length mismatch: ${lengths.join(', ')}`);
            }

            // DETAILED VALIDATION OF EACH FIELD
            for (let i = 0; i < trackData.artistWallets.length; i++) {
                console.log(`\n=== Validating Track ${i} ===`);
                
                // Validate wallet address
                const wallet = trackData.artistWallets[i];
                console.log('Wallet:', wallet);
                if (!wallet) {
                    throw new Error(`Missing wallet address at index ${i}`);
                }
                if (typeof wallet !== 'string') {
                    throw new Error(`Wallet address at index ${i} is not a string: ${typeof wallet}`);
                }
                if (!wallet.startsWith('0x')) {
                    throw new Error(`Invalid wallet address format at index ${i}: ${wallet} (must start with 0x)`);
                }
                if (wallet.length !== 42) {
                    throw new Error(`Invalid wallet address length at index ${i}: ${wallet} (must be 42 characters, got ${wallet.length})`);
                }
                
                // Validate artist name
                const artistName = trackData.artistNames[i];
                console.log('Artist name:', artistName);
                if (!artistName) {
                    throw new Error(`Missing artist name at index ${i}`);
                }
                if (typeof artistName !== 'string') {
                    throw new Error(`Artist name at index ${i} is not a string: ${typeof artistName}`);
                }
                if (artistName.trim().length === 0) {
                    throw new Error(`Empty artist name at index ${i}`);
                }
                
                // Validate track title
                const trackTitle = trackData.trackTitles[i];
                console.log('Track title:', trackTitle);
                if (!trackTitle) {
                    throw new Error(`Missing track title at index ${i}`);
                }
                if (typeof trackTitle !== 'string') {
                    throw new Error(`Track title at index ${i} is not a string: ${typeof trackTitle}`);
                }
                if (trackTitle.trim().length === 0) {
                    throw new Error(`Empty track title at index ${i}`);
                }
                
                // Validate genre
                const genre = trackData.genres[i];
                console.log('Genre:', genre);
                if (!genre) {
                    throw new Error(`Missing genre at index ${i}`);
                }
                if (typeof genre !== 'string') {
                    throw new Error(`Genre at index ${i} is not a string: ${typeof genre}`);
                }
                if (!officialGenres.includes(genre)) {
                    throw new Error(`Invalid genre "${genre}" at index ${i}. Valid genres: ${officialGenres.join(', ')}`);
                }
                
                // Validate video URL
                const videoUrl = trackData.videoUrls[i];
                console.log('Video URL:', videoUrl);
                if (!videoUrl) {
                    throw new Error(`Missing video URL at index ${i}`);
                }
                if (typeof videoUrl !== 'string') {
                    throw new Error(`Video URL at index ${i} is not a string: ${typeof videoUrl}`);
                }
                if (videoUrl.trim().length === 0) {
                    throw new Error(`Empty video URL at index ${i}`);
                }
                // Check if it's a valid IPFS URL format
                if (!videoUrl.startsWith('https://') && !videoUrl.startsWith('ipfs://') && !videoUrl.startsWith('Qm')) {
                    console.warn(`Video URL at index ${i} might not be a valid IPFS URL: ${videoUrl}`);
                }
                
                // Validate cover image URL
                const coverImageUrl = trackData.coverImageUrls[i];
                console.log('Cover image URL:', coverImageUrl);
                if (!coverImageUrl) {
                    throw new Error(`Missing cover image URL at index ${i}`);
                }
                if (typeof coverImageUrl !== 'string') {
                    throw new Error(`Cover image URL at index ${i} is not a string: ${typeof coverImageUrl}`);
                }
                if (coverImageUrl.trim().length === 0) {
                    throw new Error(`Empty cover image URL at index ${i}`);
                }
                // Check if it's a valid IPFS URL format
                if (!coverImageUrl.startsWith('https://') && !coverImageUrl.startsWith('ipfs://') && !coverImageUrl.startsWith('Qm')) {
                    console.warn(`Cover image URL at index ${i} might not be a valid IPFS URL: ${coverImageUrl}`);
                }
                
                console.log(`✅ Track ${i} validation passed`);
            }
            
            console.log('=== ALL VALIDATION PASSED ===');

            setSnackbar({ open: true, message: "3/6: Simulating transaction..." });

            // First simulate the transaction to catch errors early
            try {
                console.log('=== SIMULATING CONTRACT CALL ===');
                console.log('Contract address:', AXEP_VOTING_CONTRACT_ADDRESS);
                console.log('User address:', userAddress);
                console.log('Args being sent:', [
                    trackData.artistWallets,
                    trackData.artistNames,
                    trackData.trackTitles,
                    trackData.genres,
                    trackData.videoUrls,
                    trackData.coverImageUrls,
                ]);
                
                const simulationResult = await publicClient.simulateContract({
                    address: AXEP_VOTING_CONTRACT_ADDRESS,
                    abi: AXEP_VOTING_CONTRACT_ABI,
                    functionName: 'batchRegisterAndUpload',
                    args: [
                        trackData.artistWallets,
                        trackData.artistNames,
                        trackData.trackTitles,
                        trackData.genres,
                        trackData.videoUrls,
                        trackData.coverImageUrls,
                    ],
                    account: userAddress,
                });
                
                console.log('✅ Contract simulation successful:', simulationResult);
            } catch (simulationError: any) {
                console.error('❌ Contract simulation failed:', simulationError);
                console.error('Simulation error details:', {
                    message: simulationError.message,
                    shortMessage: simulationError.shortMessage,
                    details: simulationError.details,
                    cause: simulationError.cause,
                    data: simulationError.data
                });
                
                // Try to decode the revert reason if available
                if (simulationError.data) {
                    console.error('Raw error data:', simulationError.data);
                }
                
                throw new Error(`Contract simulation failed: ${simulationError.shortMessage || simulationError.message}`);
            }
            
            // Get optimized gas prices for Polygon Amoy
            const gasConfig = await getOptimizedGasPrice();
            console.log('Using optimized gas prices:', gasConfig);

            // Get wallet-specific configuration for hardware wallet optimization
            const walletGasConfig = getGasConfig(walletType);
            console.log('Using wallet-specific gas config:', walletGasConfig, 'for wallet:', walletType);

            // Hardware wallet specific messaging
            if (isUsingHardwareWallet) {
                setSnackbar({ open: true, message: "4/6: Hardware wallet detected. Please confirm on your device (this may take longer)..." });
            } else {
                setSnackbar({ open: true, message: "4/6: Please approve the transaction in your wallet..." });
            }

            // Retry logic for Polygon Amoy testnet instability with exponential backoff
            const maxRetries = walletGasConfig.MAX_RETRIES;
            let retryCount = 0;
            let hash: `0x${string}` | undefined;
            
            while (retryCount < maxRetries) {
                try {
                    hash = await writeContractAsync({
                        address: AXEP_VOTING_CONTRACT_ADDRESS,
                        abi: AXEP_VOTING_CONTRACT_ABI,
                        functionName: 'batchRegisterAndUpload',
                        args: [
                            trackData.artistWallets,
                            trackData.artistNames,
                            trackData.trackTitles,
                            trackData.genres,
                            trackData.videoUrls,
                            trackData.coverImageUrls,
                        ],
                        gas: GAS_CONFIG.BATCH_OPERATION_GAS_LIMIT,
                        maxFeePerGas: walletGasConfig.MAX_FEE_PER_GAS,
                        maxPriorityFeePerGas: walletGasConfig.MAX_PRIORITY_FEE_PER_GAS,
                    });
                    console.log(`Transaction successful on attempt ${retryCount + 1}`);
                    break; // Success, exit retry loop
                } catch (retryError: any) {
                    retryCount++;
                    console.warn(`Transaction attempt ${retryCount} failed:`, retryError.message);
                    
                    if (retryCount >= maxRetries) {
                        throw retryError; // Final attempt failed
                    }
                    
                    // Don't retry user rejections or certain error types
                    if (retryError.message?.includes('User rejected') || 
                        retryError.message?.includes('User denied') ||
                        retryError.message?.includes('insufficient funds')) {
                        throw retryError;
                    }
                    
                    // Hardware wallet specific retry messaging and timing
                    const waitTime = walletGasConfig.RETRY_DELAY * Math.pow(2, retryCount - 1);
                    const waitTimeSeconds = Math.round(waitTime / 1000);
                    
                    if (isUsingHardwareWallet) {
                        setSnackbar({ 
                            open: true, 
                            message: `4/6: Hardware wallet retry ${retryCount}/${maxRetries} - Please wait ${waitTimeSeconds}s before next confirmation...` 
                        });
                    } else {
                        setSnackbar({ 
                            open: true, 
                            message: `4/6: Retry ${retryCount}/${maxRetries} - Network instability detected, retrying in ${waitTimeSeconds}s...` 
                        });
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
            
            if (!hash) {
                throw new Error('Transaction failed after all retry attempts');
            }

            setSnackbar({ open: true, message: `5/6: Transaction sent! Waiting for confirmation...` });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            const trackUploadedLogs = parseEventLogs({
                abi: AXEP_VOTING_CONTRACT_ABI,
                logs: receipt.logs,
                eventName: 'TrackUploaded',
                strict: false,
            });
            
            if (trackUploadedLogs.length === 0) {
                 setSnackbar({ open: true, message: 'Transaction confirmed, but no "TrackUploaded" events were found.' });
                 setIsPublishing(false);
                 return;
            }

            setSnackbar({ open: true, message: `6/6: Confirmed! Syncing ${trackUploadedLogs.length} tracks with backend...` });
            
            const updatePromises = trackUploadedLogs.map(async (log: any) => {
                const coverUrl = log.args.coverImageUrl;
                const originalTrack = tracksToPublish.find(t => t.coverImageUrl === coverUrl);

                if (originalTrack) {
                    await api.patch(`/admin/submissions/${originalTrack.id}`, {
                        status: 'published',
                        onChainId: Number(log.args.trackId)
                    });
                }
            });

            await Promise.all(updatePromises);

            setSnackbar({ open: true, message: 'Successfully published and synced all tracks!' });
            fetchAllData();
            
        } catch (err: any) {
            console.error('Full error object:', err);
            
            let errorMsg = "An error occurred during publishing.";
            
            // Handle different types of errors with specific guidance based on research
            if (err.message?.includes('Internal JSON-RPC error')) {
                errorMsg = "🔄 Polygon Amoy Network Issue: This is a known testnet instability problem. The optimized retry mechanism has attempted the transaction multiple times. Please wait a few minutes and try again, or switch to a different RPC endpoint.";
            } else if (err.message?.includes('User rejected')) {
                errorMsg = "Transaction was rejected by user.";
            } else if (err.message?.includes('insufficient funds')) {
                errorMsg = "Insufficient MATIC balance for gas fees. Please add more MATIC to your wallet.";
            } else if (err.message?.includes('Array length mismatch')) {
                errorMsg = err.message;
            } else if (err.message?.includes('Invalid wallet address')) {
                errorMsg = err.message;
            } else if (err.message?.includes('Missing')) {
                errorMsg = err.message;
            } else if (err.message?.includes('Invalid genre')) {
                errorMsg = err.message;
            } else if (err.message?.includes('Contract simulation failed')) {
                errorMsg = err.message;
            } else if (err.message?.includes('Transaction failed after all retry attempts')) {
                errorMsg = "⚠️ Multiple retry attempts failed. Please check your network connection and try again in a few minutes.";
            } else if (err.shortMessage) {
                errorMsg = err.shortMessage;
            } else if (err.message) {
                errorMsg = err.message;
            } else if (err.response?.data?.error) {
                errorMsg = err.response.data.error;
                if (err.response.data.details) {
                    errorMsg += ` - ${err.response.data.details}`;
                }
            }
            
            setSnackbar({ open: true, message: `Error: ${errorMsg}` });
        } finally {
            setIsPublishing(false);
        }
    };

    const handleTallyVotes = async () => {
        setIsTallying(true);
        setSnackbar({ open: true, message: "Fetching vote tally..." });
        try {
            const tallyRes = await api.get('/admin/votes/tally');
            const { trackIds, voteCounts } = tallyRes.data;

            if (!trackIds || trackIds.length === 0) {
                setSnackbar({ open: true, message: 'No unprocessed votes for published tracks.' });
                setIsTallying(false);
                return;
            }

            setSnackbar({ open: true, message: 'Tally received. Submitting to blockchain...' });

            const { request } = await publicClient.simulateContract({
                address: AXEP_VOTING_CONTRACT_ADDRESS,
                abi: AXEP_VOTING_CONTRACT_ABI,
                functionName: 'adminBatchVote',
                args: [trackIds, voteCounts],
                account: userAddress,
            });

            const hash = await writeContractAsync(request);
            setSnackbar({ open: true, message: `Transaction sent! Hash: ${hash}. Clearing votes...` });

            await api.post('/votes/clear');
            
            setSnackbar({ open: true, message: 'Votes tallied and submitted to the chain successfully!' });
            fetchAllData();

        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.shortMessage || err.message || "An error occurred during vote tallying.";
            setSnackbar({ open: true, message: `Error: ${errorMsg}` });
        } finally {
            setIsTallying(false);
        }
    };

    if (loading) return <Container sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Container>;
    if (error) return <Container><Alert severity="error">{error}</Alert></Container>;

    if (!isOwner) {
        return (
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                <Alert severity="error">
                    <Typography>Access Denied</Typography>
                    <Typography>You are not authorized to view this page. Please connect with the owner wallet.</Typography>
                </Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>Admin Dashboard</Typography>
            
            {/* Backend Status Indicator */}
            {backendStatus !== 'awake' && (
                <Alert 
                    severity={backendStatus === 'error' ? 'error' : 'info'} 
                    sx={{ mb: 3 }}
                >
                    {backendStatus === 'checking' && '🔍 Checking backend status...'}
                    {backendStatus === 'waking' && '🔄 Backend is waking up, please wait...'}
                    {backendStatus === 'error' && '❌ Backend connection failed. Please refresh the page.'}
                </Alert>
            )}

            {/* Hardware Wallet Status Indicator */}
            {isUsingHardwareWallet && (
                <Alert 
                    severity="info" 
                    sx={{ mb: 3 }}
                >
                    🔐 Hardware wallet detected ({walletType}). Optimized settings active: longer timeouts, higher gas limits, and enhanced retry logic for better compatibility.
                </Alert>
            )}

            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}><Card><CardContent><Typography>Pending Submissions</Typography><Typography variant="h5">{stats.pending}</Typography></CardContent></Card></Grid>
                <Grid item xs={12} sm={6} md={3}><Card><CardContent><Typography>Approved (Not Live)</Typography><Typography variant="h5">{stats.approved}</Typography></CardContent></Card></Grid>
                <Grid item xs={12} sm={6} md={3}><Card><CardContent><Typography>Pending Shares</Typography><Typography variant="h5">{stats.pendingShares}</Typography></CardContent></Card></Grid>
                <Grid item xs={12} sm={6} md={3}><Card><CardContent><Typography>Unprocessed Votes</Typography><Typography variant="h5">{stats.unprocessedVotes}</Typography></CardContent></Card></Grid>
            </Grid>
            
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 2 }}>
                <Button variant="contained" color="secondary" onClick={handlePublishAll} disabled={isPublishing || stats.approved === 0 || !isOwner}>
                    {isPublishing ? <CircularProgress size={24} /> : `Publish ${stats.approved} Approved Tracks`}
                </Button>
                <Button variant="contained" color="info" onClick={handleTallyVotes} disabled={isTallying || stats.unprocessedVotes === 0 || !isOwner}>
                    {isTallying ? <CircularProgress size={24} /> : `Tally ${stats.unprocessedVotes} Votes`}
                </Button>
            </Box>

            <Typography variant="h5" sx={{mt: 4, mb: 2}}>Track Submissions</Typography>
            <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }} aria-label="submissions table">
                    <TableHead>
                        <TableRow>
                            <TableCell>Artist</TableCell>
                            <TableCell>Track Title</TableCell>
                            <TableCell>Week</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Submitted</TableCell>
                            <TableCell>Links</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {submissions.map((track) => (
                            <TableRow key={track.id}>
                                <TableCell>{track.artist}<br/><Typography variant="caption">{track.artistWallet}</Typography></TableCell>
                                <TableCell>{track.title}</TableCell>
                                <TableCell>{track.weekNumber}</TableCell>
                                <TableCell>{track.status}</TableCell>
                                <TableCell>{new Date(track.submittedAt).toLocaleDateString()}</TableCell>
                                <TableCell>
                                    {track.videoUrl && <Link href={track.videoUrl} target="_blank">Video</Link>}<br/>
                                    {track.coverImageUrl && <Link href={track.coverImageUrl} target="_blank">Cover</Link>}
                                </TableCell>
                                <TableCell>
                                    {track.status === 'pending' && (
                                        <>
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                onClick={() => handleApprove(track.id)}
                                                disabled={isApproving[track.id]}
                                            >
                                                {isApproving[track.id] ? <CircularProgress size={24} /> : 'Approve'}
                                            </Button>
                                            <Button
                                                variant="contained"
                                                color="secondary"
                                                onClick={() => handleReject(track.id)}
                                                disabled={isApproving[track.id]}
                                                style={{ marginLeft: '10px' }}
                                            >
                                                Reject
                                            </Button>
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Typography variant="h5" sx={{mt: 4, mb: 2}}>Proof of Share Submissions</Typography>
            <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }} aria-label="proof of shares table">
                    <TableHead>
                        <TableRow>
                            <TableCell>User</TableCell>
                            <TableCell>Track</TableCell>
                            <TableCell>Share URL 1</TableCell>
                            <TableCell>Share URL 2</TableCell>
                            <TableCell>Submitted</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {shareSubmissions.map((share) => (
                            <TableRow key={share.id}>
                                <TableCell><Typography variant="caption">{share.userWallet}</Typography></TableCell>
                                <TableCell>{share.track.title} - {share.track.artist}</TableCell>
                                <TableCell><Link href={share.shareUrl1} target="_blank" rel="noopener noreferrer">Link 1</Link></TableCell>
                                <TableCell><Link href={share.shareUrl2} target="_blank" rel="noopener noreferrer">Link 2</Link></TableCell>
                                <TableCell>{new Date(share.submittedAt).toLocaleString()}</TableCell>
                                <TableCell>{share.status}</TableCell>
                                <TableCell>
                                    {share.status === 'pending' && (
                                        <Box sx={{display: 'flex', gap: 1}}>
                                            <Button
                                                variant="contained"
                                                color="success"
                                                size="small"
                                                sx={{ mr: 1 }}
                                                onClick={() => handleUpdateShareStatus(share.id, 'verified')}
                                                disabled={isUpdatingShare[share.id] || !isOwner}
                                            >
                                                {isUpdatingShare[share.id] ? <CircularProgress size={20} /> : 'Verify'}
                                            </Button>
                                            <Button
                                                variant="contained"
                                                color="error"
                                                size="small"
                                                onClick={() => handleUpdateShareStatus(share.id, 'rejected')}
                                                disabled={isUpdatingShare[share.id] || !isOwner}
                                            >
                                                {isUpdatingShare[share.id] ? <CircularProgress size={20} /> : 'Reject'}
                                            </Button>
                                        </Box>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                message={snackbar.message}
            />
        </Container>
    );
};

export default AdminPage;