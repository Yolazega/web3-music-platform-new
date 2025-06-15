import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Track, Share, Vote } from '../types';
import {
    Container, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button,
    CircularProgress, Card, CardContent, Grid, Alert, Box, Typography, Link, Snackbar
} from '@mui/material';
import { useWriteContract } from 'wagmi';
import { AXEP_VOTING_CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI, AMOY_RPC_URL } from '../config';
import { ethers } from 'ethers';
import { createPublicClient, http, parseLog } from 'viem';
import { polygonAmoy } from 'viem/chains';

// --- viem Public Client Setup ---
const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http(AMOY_RPC_URL)
});

const AdminPage: React.FC = () => {
    const [submissions, setSubmissions] = useState<Track[]>([]);
    const [shares, setShares] = useState<Share[]>([]);
    const [votes, setVotes] = useState<Vote[]>([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState<Track[]>([]);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'published'>('all');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isApproving, setIsApproving] = useState<Record<string, boolean>>({});
    const [isPublishing, setIsPublishing] = useState<boolean>(false);
    const [isTallying, setIsTallying] = useState<boolean>(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean, message: string }>({ open: false, message: '' });

    const { writeContractAsync } = useWriteContract();

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [submissionsRes, sharesRes, votesRes] = await Promise.all([
                api.get('/admin/submissions'),
                api.get('/admin/shares'),
                api.get('/admin/votes')
            ]);
            setSubmissions(submissionsRes.data.sort((a: Track, b: Track) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
            setShares(sharesRes.data);
            setVotes(votesRes.data);
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
        pendingShares: shares.filter(s => s.status === 'pending').length,
        unprocessedVotes: votes.filter(v => v.status === 'unprocessed').length,
    }), [submissions, shares, votes]);

    const handleApprove = async (id: string) => {
        setIsApproving(prev => ({...prev, [id]: true}));
        try {
            await api.post(`/admin/approve/${id}`);
            fetchAllData();
        } catch (err) { 
            alert(`Error approving submission ${id}.`); 
        } finally {
            setIsApproving(prev => ({...prev, [id]: false}));
        }
    };
    
    const handlePublishAll = async () => {
        if (!window.confirm("This will register all 'Approved' tracks on the blockchain. Continue?")) {
            return;
        }
        setIsPublishing(true);
        setSnackbar({ open: true, message: "1/4: Fetching track data..." });
        try {
            // 1. Get track data from backend
            const { data } = await api.get('/admin/get-publish-data');
            
            if (!data.trackData) {
                setSnackbar({ open: true, message: data.message || 'No new tracks to publish.' });
                setIsPublishing(false);
                return;
            }

            setSnackbar({ open: true, message: "2/4: Please approve the transaction in your wallet..." });

            // 2. Call the smart contract
            const hash = await writeContractAsync({
                address: AXEP_VOTING_CONTRACT_ADDRESS,
                abi: AXEP_VOTING_CONTRACT_ABI,
                functionName: 'batchRegisterAndUpload',
                args: [
                    data.trackData.artistWallets,
                    data.trackData.artistNames,
                    data.trackData.trackTitles,
                    data.trackData.genres,
                    data.trackData.videoUrls,
                    data.trackData.coverImageUrls,
                ],
            });

            setSnackbar({ open: true, message: `3/4: Transaction sent! Waiting for confirmation...` });

            // 3. Get Transaction Receipt and Parse Logs
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            const trackUploadedLogs = receipt.logs.map(log => {
                try {
                    return parseLog({
                        abi: AXEP_VOTING_CONTRACT_ABI,
                        data: log.data,
                        topics: log.topics,
                    });
                } catch {
                    return null;
                }
            }).filter(log => log && log.eventName === 'TrackUploaded');

            const successfulTracks = trackUploadedLogs.map(log => ({
                onChainId: Number(log.args.trackId),
                coverImageUrl: log.args.coverImageUrl,
            }));

            if(successfulTracks.length === 0) {
                 setSnackbar({ open: true, message: 'Transaction confirmed, but no tracks were published. Please check the transaction on a block explorer.' });
                 setIsPublishing(false);
                 return;
            }

            setSnackbar({ open: true, message: `4/4: Confirmed! Syncing ${successfulTracks.length} tracks with backend...` });
            
            // 4. Confirm publication with backend
            await api.post('/admin/confirm-publish', { successfulTracks });

            setSnackbar({ open: true, message: 'Successfully published and synced all tracks!' });
            fetchAllData(); // Refresh data
            
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
                <Button variant="contained" color="secondary" onClick={handlePublishAll} disabled={isPublishing || stats.approved === 0}>
                    {isPublishing ? <CircularProgress size={24} /> : `Publish ${stats.approved} Approved Tracks`}
                </Button>
                <Button variant="contained" color="info" onClick={handleTallyVotes} disabled={isTallying || stats.unprocessedVotes === 0}>
                    {isTallying ? <CircularProgress size={24} /> : `Tally ${stats.unprocessedVotes} Votes`}
                </Button>
            </Box>

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
                                        <Button 
                                            size="small" 
                                            variant="contained" 
                                            color="success" 
                                            onClick={() => handleApprove(track.id)}
                                            disabled={isApproving[track.id]}
                                        >
                                            {isApproving[track.id] ? <CircularProgress size={20}/> : 'Approve'}
                                        </Button>
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