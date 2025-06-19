import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Track, Share, Vote } from '../types';
import {
    Container, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button,
    CircularProgress, Card, CardContent, Grid, Alert, Box, Typography, Link, Snackbar
} from '@mui/material';
import { useWriteContract, useAccount } from 'wagmi';
import { AXEP_VOTING_CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI, AMOY_RPC_URL } from '../config';
import { ethers } from 'ethers';
import { createPublicClient, http, parseEventLogs } from 'viem';
import { readContract } from 'viem/actions';
import { polygonAmoy } from 'viem/chains';

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

// --- viem Public Client Setup ---
const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http(AMOY_RPC_URL)
});

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

    const { writeContractAsync } = useWriteContract();
    const { address: userAddress } = useAccount();

    useEffect(() => {
        const checkOwner = async () => {
            try {
                const contractOwner = await readContract(publicClient, {
                    address: AXEP_VOTING_CONTRACT_ADDRESS,
                    abi: AXEP_VOTING_CONTRACT_ABI,
                    functionName: 'owner',
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
            const [submissionsRes, votesRes, shareSubmissionsRes] = await Promise.all([
                api.get('/admin/submissions'),
                api.get('/admin/votes'),
                api.get('/admin/share-submissions'),
            ]);
            setSubmissions(submissionsRes.data.sort((a: Track, b: Track) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
            setVotes(votesRes.data);
            setShareSubmissions(shareSubmissionsRes.data);
        } catch (err) {
            setError("Failed to load admin data. Please try again.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

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
            await api.patch(`/admin/share-submissions/${id}`, { status });
            setSnackbar({ open: true, message: `Share status updated to ${status}.` });
            // Refresh the data to show the new status
            setShareSubmissions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
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
        setSnackbar({ open: true, message: "1/4: Preparing track data..." });

        try {
            const trackData = {
                artistWallets: tracksToPublish.map(t => t.artistWallet as `0x${string}`),
                artistNames: tracksToPublish.map(t => t.artist),
                trackTitles: tracksToPublish.map(t => t.title),
                genres: tracksToPublish.map(t => t.genre),
                videoUrls: tracksToPublish.map(t => t.videoUrl || ''),
                coverImageUrls: tracksToPublish.map(t => t.coverImageUrl || ''),
            };
            
            setSnackbar({ open: true, message: "2/4: Please approve the transaction in your wallet..." });

            const hash = await writeContractAsync({
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
            });

            setSnackbar({ open: true, message: `3/4: Transaction sent! Waiting for confirmation...` });

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

            setSnackbar({ open: true, message: `4/4: Confirmed! Syncing ${trackUploadedLogs.length} tracks with backend...` });
            
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
            const errorMsg = err.response?.data?.error || err.shortMessage || err.message || "An error occurred during publishing.";
            const errorDetails = err.response?.data?.details;
            const displayError = errorDetails ? `${errorMsg} ${errorDetails}` : errorMsg;
            setSnackbar({ open: true, message: `Error: ${displayError}` });
            console.error(err);
        } finally {
            setIsPublishing(false);
        }
    };

    const handleTallyVotes = async () => {
        setIsTallying(true);
        setSnackbar({ open: true, message: "Fetching vote tally..." });
        try {
            const tallyRes = await api.get('/votes/tally');
            const { trackIds, voteCounts } = tallyRes.data;

            if (!trackIds || trackIds.length === 0) {
                setSnackbar({ open: true, message: 'No unprocessed votes for published tracks.' });
                setIsTallying(false);
                return;
            }

            setSnackbar({ open: true, message: "Please approve the transaction in your wallet..." });

            const hash = await writeContractAsync({
                address: AXEP_VOTING_CONTRACT_ADDRESS,
                abi: AXEP_VOTING_CONTRACT_ABI,
                functionName: 'adminBatchVote',
                args: [trackIds, voteCounts],
            });

            setSnackbar({ open: true, message: `Transaction sent! Hash: ${hash}. Clearing votes...` });

            await api.post('/votes/clear');
            
            setSnackbar({ open: true, message: 'Votes tallied and submitted to the chain successfully!' });
            fetchAllData();

        } catch (err: any) {
            const errorMsg = err.shortMessage || err.message || "An error occurred during vote tallying.";
            setSnackbar({ open: true, message: `Error: ${errorMsg}` });
            console.error(err);
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