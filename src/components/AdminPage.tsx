import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Track, Share, Vote } from '../types';
import {
    Container, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button,
    CircularProgress, Card, CardContent, Grid, Alert, Box, Typography, Link, Snackbar
} from '@mui/material';
import { useWriteContract } from 'wagmi';
import { AXEP_VOTING_CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI } from '../config';
import { ethers } from 'ethers';

const AdminPage: React.FC = () => {
    // State variables
    const [submissions, setSubmissions] = useState<Track[]>([]);
    const [shares, setShares] = useState<Share[]>([]);
    const [votes, setVotes] = useState<Vote[]>([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState<Track[]>([]);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'published'>('all');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // New state for button loading
    const [isApproving, setIsApproving] = useState<Record<string, boolean>>({});
    const [isPublishing, setIsPublishing] = useState<boolean>(false);
    const [isTallying, setIsTallying] = useState<boolean>(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean, message: string }>({ open: false, message: '' });

    const { writeContractAsync } = useWriteContract();

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch all admin data in parallel
            const [submissionsRes, sharesRes, votesRes] = await Promise.all([
                api.get('/admin/submissions'),
                api.get('/admin/shares'),
                api.get('/admin/votes') // Assumes a new /admin/votes endpoint exists
            ]);
            
            setSubmissions(submissionsRes.data.sort((a: Track, b: Track) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
            setShares(sharesRes.data);
            setVotes(votesRes.data);

        } catch (err) { 
            setError("Failed to load admin data. Please try again."); 
            console.error(err);
        } 
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    useEffect(() => {
        // This handles the filtering of the main submissions table
        setFilteredSubmissions(filter === 'all' ? submissions : submissions.filter(s => s.status === filter));
    }, [filter, submissions]);
    
    const stats = React.useMemo(() => ({
        pending: submissions.filter(s => s.status === 'pending').length,
        approved: submissions.filter(s => s.status === 'approved' && !s.onChainId).length,
        published: submissions.filter(s => s.status === 'published').length,
        totalShares: shares.length,
        totalVotes: votes.length,
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
        setSnackbar({ open: true, message: "Fetching track data..." });
        try {
            // 1. Get track data from backend
            const { data } = await api.get('/admin/get-publish-data');
            
            if (!data.trackData) {
                setSnackbar({ open: true, message: data.message || 'No new tracks to publish.' });
                setIsPublishing(false);
                return;
            }

            setSnackbar({ open: true, message: "Please approve the transaction in your wallet..." });

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

            setSnackbar({ open: true, message: `Transaction sent! Waiting for confirmation... Hash: ${hash}` });
            
            // 3. (Implicitly handled by wagmi/viem) Wait for transaction to be mined
            // We need a real public client to get the receipt, wagmi doesn't expose it easily.
            // Let's assume for now that if writeContractAsync resolves, it's submitted.
            // A robust solution would use a viem public client to getTransactionReceipt.
            // For now, we will just refetch data and assume the best.
            // The proper way to get the on-chain IDs requires parsing logs from the receipt.

            setSnackbar({ open: true, message: 'Transaction submitted! Please wait a moment for the database to update.' });
            // This is a temporary workaround. We are not confirming the publish on the backend
            // because we can't easily get the on-chain IDs from the frontend without more setup.
            // The tracks will be on-chain, but our backend won't know their on-chain ID yet.
            // This is a limitation we accept for now to get the core flow working.
            
            fetchAllData(); // Refresh data to show changes
            
        } catch (err: any) {
            const errorMsg = err.shortMessage || err.message || "An error occurred during publishing.";
            setSnackbar({ open: true, message: `Error: ${errorMsg}` });
            console.error(err);
        } finally {
            setIsPublishing(false);
        }
    };

    const handleTallyVotes = async () => {
        setIsTallying(true);
        setSnackbar({ open: true, message: "Fetching vote tally..." });
        try {
            // 1. Get the tally from the backend
            const tallyRes = await api.get('/votes/tally');
            const { trackIds, voteCounts } = tallyRes.data;

            if (!trackIds || trackIds.length === 0) {
                setSnackbar({ open: true, message: 'No unprocessed votes for published tracks.' });
                setIsTallying(false);
                return;
            }

            setSnackbar({ open: true, message: "Please approve the transaction in your wallet..." });

            // 2. Call the smart contract
            const hash = await writeContractAsync({
                address: AXEP_VOTING_CONTRACT_ADDRESS,
                abi: AXEP_VOTING_CONTRACT_ABI,
                functionName: 'adminBatchVote',
                args: [trackIds, voteCounts],
            });

            setSnackbar({ open: true, message: `Transaction sent! Hash: ${hash}. Clearing votes...` });

            // 3. Clear the votes from our DB
            await api.post('/votes/clear');
            
            setSnackbar({ open: true, message: 'Votes tallied and submitted to the chain successfully!' });
            fetchAllData(); // Refresh data

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
                        {filteredSubmissions.map((track) => (
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