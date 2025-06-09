import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Track } from '../types';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { AXEP_VOTING_CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI } from '../config';
import { parseEventLogs } from 'viem';
import {
    Container, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button,
    Modal, Box, Typography, TextField, CircularProgress, Card, CardContent, Grid, Link, TextareaAutosize, Alert, IconButton, Snackbar
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

const modalStyle = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  maxWidth: 800,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
  maxHeight: '90vh',
  overflowY: 'auto'
};

const AdminPage: React.FC = () => {
    // Submissions State
    const [submissions, setSubmissions] = useState<Track[]>([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState<Track[]>([]);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'published' | 'shares'>('all');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Batch Publishing State
    const [isBatchPublishModalOpen, setIsBatchPublishModalOpen] = useState(false);
    const [batchPublishData, setBatchPublishData] = useState<Record<string, any> | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [tempTxHash, setTempTxHash] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    // Share Rewards State
    const [sharesByTrack, setSharesByTrack] = useState<{ [trackId: string]: any }>({});
    const [isSharesLoading, setIsSharesLoading] = useState<boolean>(true);

    // Vote Tally State
    const [isVoteTallyModalOpen, setIsVoteTallyModalOpen] = useState(false);
    const [voteTally, setVoteTally] = useState<Record<string, number> | null>(null);
    const [tallyTrackIds, setTallyTrackIds] = useState<string[]>([]);
    const [tallyVoteCounts, setTallyVoteCounts] = useState<string[]>([]);
    const [isTallyLoading, setIsTallyLoading] = useState(false);
    const [tallyError, setTallyError] = useState<string|null>(null);
    const [isClearingVotes, setIsClearingVotes] = useState(false);
    
    // Wagmi Hooks
    const { data: hash, writeContract } = useWriteContract();
    const { data: syncReceipt, isLoading: isWaitingForSyncReceipt } = useWaitForTransactionReceipt({ hash: tempTxHash ? tempTxHash as `0x${string}` : undefined });

    // Data Fetching
    const fetchSubmissions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/submissions');
            const tracksData: Track[] = res.data?.tracks ?? [];
            setSubmissions(tracksData.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
        } catch (err) { setError("Failed to load submissions."); } 
        finally { setLoading(false); }
    }, []);

    const fetchShares = useCallback(async () => {
        setIsSharesLoading(true);
        try {
            const res = await api.get('/shares-by-track');
            setSharesByTrack(res.data.sharesByTrack);
        } catch (err) { console.error("Failed to fetch shares:", err); } 
        finally { setIsSharesLoading(false); }
    }, []);

    const fetchVoteTally = useCallback(async () => {
        setIsTallyLoading(true);
        setTallyError(null);
        try {
            const res = await api.get('/votes/tally');
            setVoteTally(res.data.tally);
            setTallyTrackIds(res.data.trackIds);
            setTallyVoteCounts(res.data.voteCounts);
        } catch (err) {
            setTallyError("Failed to fetch vote tally.");
            console.error("Failed to fetch vote tally:", err);
        } finally {
            setIsTallyLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubmissions();
        fetchShares();
        fetchVoteTally();
    }, [fetchSubmissions, fetchShares, fetchVoteTally]);

    // Filtering
    useEffect(() => {
        if (filter !== 'shares') {
            setFilteredSubmissions(filter === 'all' ? submissions : submissions.filter(s => s.status === filter));
        }
    }, [filter, submissions]);
    
    // Memoized Stats & Data
    const stats = React.useMemo(() => ({
        pending: submissions.filter(s => s.status === 'pending').length,
        approved: submissions.filter(s => s.status === 'approved').length,
        published: submissions.filter(s => s.status === 'published').length,
        unprocessedVotes: Object.values(voteTally || {}).reduce((sum, count) => sum + count, 0),
        totalSubmissions: submissions.length,
    }), [submissions, voteTally]);

    const trackIdToTitleMap = React.useMemo(() => submissions.reduce((acc: Record<string, string>, track) => {
        if (track.onChainTrackId) acc[track.onChainTrackId] = track.trackTitle;
        return acc;
    }, {}), [submissions]);

    // Handlers
    const handleStatusChange = async (id: string, status: 'approved' | 'rejected') => {
        try {
            await api.patch(`/submissions/${id}`, { status });
            fetchSubmissions();
        } catch (err) { alert(`Error updating status for submission ${id}.`); }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this submission?')) {
            try {
                await api.delete(`/submissions/${id}`);
                fetchSubmissions();
            } catch (err) { alert(`Error deleting submission ${id}.`); }
        }
    };

    const handleCopyToClipboard = (key: string, data: any) => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handleConfirmBatchPublication = (txHash: string) => {
        if (!txHash.startsWith('0x') || txHash.length !== 66) return alert('Invalid transaction hash.');
        setTempTxHash(txHash);
    };
    
    const handleSyncOnChainData = useCallback(async (receipt: any) => {
        setIsSyncing(true); setSyncError(null);
        try {
            const logs = parseEventLogs({ abi: AXEP_VOTING_CONTRACT_ABI, logs: receipt.logs, eventName: 'TrackUploaded' });
            const updatedTracks = logs.map(log => ({
                onChainTrackId: log.args.trackId.toString(),
                videoUrl: log.args.videoUrl, 
            }));
            if (updatedTracks.length === 0) return setSyncError("No 'TrackUploaded' events found.");
            await api.post('/submissions/sync-onchain', { tracks: updatedTracks });
            alert('On-chain data synchronized!');
            setIsBatchPublishModalOpen(false);
            setTempTxHash('');
            fetchSubmissions();
        } catch (err) { setSyncError("An error occurred during sync."); } 
        finally { setIsSyncing(false); }
    }, [fetchSubmissions]);

    useEffect(() => {
        if (syncReceipt) handleSyncOnChainData(syncReceipt);
    }, [syncReceipt, handleSyncOnChainData]);
    
    const handleClearVotes = async () => {
        setIsClearingVotes(true);
        try {
            await api.post('/votes/clear');
            alert("Tallied votes have been cleared from the queue.");
            fetchVoteTally();
            setIsVoteTallyModalOpen(false);
        } catch(err) {
            alert("Failed to clear votes.");
        } finally {
            setIsClearingVotes(false);
        }
    }
    
    if (loading) return <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Container>;
    if (error) return <Container sx={{ color: 'red', textAlign: 'center', mt: 4 }}>{error}</Container>;

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>Admin Dashboard</Typography>
            
            <Grid container spacing={2} sx={{ mb: 4 }}>
                {Object.entries(stats).map(([key, value]) => (
                    <Grid item xs={12} sm={6} md={2.4} key={key}>
                        <Card>
                            <CardContent>
                                <Typography sx={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</Typography>
                                <Typography variant="h4">{value}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                 <Box>
                    {(['all', 'pending', 'approved', 'rejected', 'published', 'shares'] as const).map(f => (
                        <Button key={f} variant={f === filter ? "contained" : "outlined"} onClick={() => setFilter(f)} sx={{ mr: 1, mb: 1 }}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </Button>
                    ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button variant="contained" color="secondary" onClick={() => setIsBatchPublishModalOpen(true)} disabled={stats.approved === 0}>
                        Publish Approved ({stats.approved})
                    </Button>
                    <Button variant="contained" color="success" onClick={() => setIsVoteTallyModalOpen(true)} disabled={stats.unprocessedVotes === 0}>
                        Tally Votes ({stats.unprocessedVotes})
                    </Button>
                </Box>
            </Box>

            {/* Vote Tally Modal */}
            <Modal open={isVoteTallyModalOpen} onClose={() => setIsVoteTallyModalOpen(false)}>
                <Box sx={modalStyle}>
                    <Typography variant="h6" component="h2">Vote Tally & Submission</Typography>
                    {isTallyLoading && <CircularProgress />}
                    {tallyError && <Alert severity="error">{tallyError}</Alert>}
                    {voteTally && stats.unprocessedVotes > 0 ? (
                        <>
                            <Typography sx={{ mt: 2 }}>
                                Total unprocessed votes: <strong>{stats.unprocessedVotes}</strong>.
                                <br/>
                                Use the data below to call the `adminBatchVote` function. After the transaction is confirmed, click the clear button.
                            </Typography>
                             <Box sx={{ mt: 2, p: 2, border: '1px solid grey', borderRadius: 1, backgroundColor: '#f5f5f5' }}>
                                <Typography variant="body2"><strong>Track IDs to vote for:</strong></Typography>
                                <pre>{JSON.stringify(tallyTrackIds)}</pre>
                                <IconButton onClick={() => handleCopyToClipboard('tallyTrackIds', tallyTrackIds)}>
                                    {copiedKey === 'tallyTrackIds' ? <CheckIcon /> : <ContentCopyIcon />}
                                </IconButton>
                            </Box>
                             <Box sx={{ mt: 2, p: 2, border: '1px solid grey', borderRadius: 1, backgroundColor: '#f5f5f5' }}>
                                <Typography variant="body2"><strong>Corresponding vote counts:</strong></Typography>
                                <pre>{JSON.stringify(tallyVoteCounts)}</pre>
                                <IconButton onClick={() => handleCopyToClipboard('tallyVoteCounts', tallyVoteCounts)}>
                                    {copiedKey === 'tallyVoteCounts' ? <CheckIcon /> : <ContentCopyIcon />}
                                </IconButton>
                            </Box>
                            <Button
                                fullWidth
                                variant="contained"
                                color="warning"
                                onClick={handleClearVotes}
                                disabled={isClearingVotes}
                                sx={{ mt: 3 }}
                            >
                                {isClearingVotes ? <CircularProgress size={24} /> : 'Confirm & Clear Tallied Votes'}
                            </Button>
                        </>
                    ) : (
                        <Typography sx={{ mt: 2 }}>No unprocessed votes to tally.</Typography>
                    )}
                </Box>
            </Modal>
            
            {/* The rest of the page (tables, other modals etc.) remains here */}
            {/* ... */}
        </Container>
    );
};

export default AdminPage; 