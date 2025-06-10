import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Track } from '../types';
import { useWaitForTransactionReceipt } from 'wagmi';
import { AXEP_VOTING_CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI } from '../config';
import { parseEventLogs, Log } from 'viem';
import {
    Container, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button,
    Modal, Box, Typography, TextField, CircularProgress, Card, CardContent, Grid, Link, Alert, IconButton
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

// Define a more specific type for the parsed event logs
type TrackUploadedEventLog = Log & {
    eventName: 'TrackUploaded';
    args: {
        trackId: bigint;
        videoUrl: string;
    };
};

const AdminPage: React.FC = () => {
    // State variables...
    const [submissions, setSubmissions] = useState<Track[]>([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState<Track[]>([]);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'published' | 'shares'>('all');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isBatchPublishModalOpen, setIsBatchPublishModalOpen] = useState(false);
    const [batchPublishData, setBatchPublishData] = useState<Record<string, any> | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [sharesByTrack, setSharesByTrack] = useState<{ [trackId: string]: any }>({});
    const [isSharesLoading, setIsSharesLoading] = useState<boolean>(true);
    const [isVoteTallyModalOpen, setIsVoteTallyModalOpen] = useState(false);
    const [voteTally, setVoteTally] = useState<Record<string, number> | null>(null);
    const [tallyTrackIds, setTallyTrackIds] = useState<string[]>([]);
    const [tallyVoteCounts, setTallyVoteCounts] = useState<number[]>([]);
    const [isTallyLoading, setIsTallyLoading] = useState(false);
    const [tallyError, setTallyError] = useState<string|null>(null);
    const [isMarkingTallied, setIsMarkingTallied] = useState(false);
    
    const { data: syncReceipt, isLoading: isWaitingForSyncReceipt } = useWaitForTransactionReceipt({ hash: txHash });

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
            setSharesByTrack(res.data.sharesByTrack || {});
        } catch (err) { console.error("Failed to fetch shares:", err); } 
        finally { setIsSharesLoading(false); }
    }, []);

    const fetchVoteTally = useCallback(async () => {
        setIsTallyLoading(true); setTallyError(null);
        try {
            const res = await api.get('/votes/tally');
            const tallyData = res.data.tally || {};
            setVoteTally(tallyData);
            setTallyTrackIds(Object.keys(tallyData));
            setTallyVoteCounts(Object.values(tallyData));
        } catch (err) {
            setTallyError("Failed to fetch vote tally.");
        } finally {
            setIsTallyLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubmissions();
        fetchShares();
        fetchVoteTally();
    }, [fetchSubmissions, fetchShares, fetchVoteTally]);

    useEffect(() => {
        if (filter !== 'shares') {
            setFilteredSubmissions(filter === 'all' ? submissions : submissions.filter(s => s.status === filter));
        }
    }, [filter, submissions]);
    
    const stats = React.useMemo(() => ({
        pending: submissions.filter(s => s.status === 'pending').length,
        approved: submissions.filter(s => s.status === 'approved').length,
        published: submissions.filter(s => s.status === 'published').length,
        unprocessedVotes: Object.values(voteTally || {}).reduce((sum, count) => sum + count, 0),
        totalSubmissions: submissions.length,
    }), [submissions, voteTally]);

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
    
    const openBatchPublishModal = () => {
        const tracksToPublish = submissions.filter(s => s.status === 'approved');
        if (tracksToPublish.length > 0) {
            setBatchPublishData({
                artistWallets: tracksToPublish.map((t) => t.artistWallet),
                artistNames: tracksToPublish.map((t) => t.artistName),
                trackTitles: tracksToPublish.map((t) => t.trackTitle),
                genres: tracksToPublish.map((t) => t.genre),
                videoUrls: tracksToPublish.map((t) => t.videoUrl),
                coverImageUrls: tracksToPublish.map((t) => t.coverImageUrl),
            });
            setIsBatchPublishModalOpen(true);
        } else {
            alert('No approved tracks are ready for publishing.');
        }
    };

    const handleCopyToClipboard = (key: string, data: any) => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2).replace(/\\"/g, '"'));
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handleConfirmBatchPublication = (hash: string) => {
        if (!hash.startsWith('0x') || hash.length !== 66) return alert('Invalid transaction hash.');
        setTxHash(hash as `0x${string}`);
    };
    
    const handleSyncOnChainData = useCallback(async (receipt: any) => {
        setIsSyncing(true); setSyncError(null);
        try {
            const logs = parseEventLogs({ abi: AXEP_VOTING_CONTRACT_ABI, logs: receipt.logs });
            const relevantLogs = logs.filter(log => log.eventName === 'TrackUploaded');

            const updatedTracks = relevantLogs.map(log => {
                const eventLog = log as TrackUploadedEventLog;
                return {
                    onChainTrackId: eventLog.args.trackId.toString(),
                    videoUrl: eventLog.args.videoUrl, 
                };
            });
            
            if (updatedTracks.length === 0) {
                setSyncError("No 'TrackUploaded' events found in this transaction.");
                setIsSyncing(false);
                return;
            };

            await api.post('/submissions/sync-onchain', { tracks: updatedTracks });
            alert('On-chain data synchronized!');
            setIsBatchPublishModalOpen(false);
            setTxHash(undefined);
            fetchSubmissions();
        } catch (err) { 
            setSyncError("An error occurred during sync. Check the console for details."); 
            console.error(err);
        } 
        finally { setIsSyncing(false); }
    }, [fetchSubmissions]);

    useEffect(() => {
        if (syncReceipt) handleSyncOnChainData(syncReceipt);
    }, [syncReceipt, handleSyncOnChainData]);
    
    const handleMarkVotesTallied = async () => {
        if (!window.confirm("CONFIRM: Have you successfully submitted the vote transaction on-chain? This will mark all unprocessed votes as tallied and cannot be undone.")) {
            return;
        }
        setIsMarkingTallied(true);
        try {
            await api.post('/votes/mark-tallied');
            alert("Votes marked as tallied successfully.");
            // Refresh data
            fetchSubmissions(); 
            fetchVoteTally();
            setIsVoteTallyModalOpen(false);
        } catch(err) {
            alert("Failed to mark votes as tallied. Please try again.");
            console.error(err);
        } finally {
            setIsMarkingTallied(false);
        }
    }
    
    if (loading) return <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Container>;
    if (error) return <Container sx={{ color: 'red', textAlign: 'center', mt: 4 }}>{error}</Container>;

    const renderContent = () => {
        if (filter === 'shares') {
            return (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Track Title</TableCell>
                                <TableCell>Total Shares</TableCell>
                                <TableCell>Unique Sharers</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isSharesLoading ? <TableRow><TableCell colSpan={4} align="center"><CircularProgress /></TableCell></TableRow> :
                             Object.keys(sharesByTrack).length > 0 ? Object.keys(sharesByTrack).map((trackId) => {
                                const shareData = sharesByTrack[trackId] || { sharers: [] };
                                const uniqueSharers = new Set(shareData.sharers).size;
                                const submission = submissions.find(s => s.onChainTrackId === trackId);
                                return (
                                    <TableRow key={trackId}>
                                        <TableCell>{submission?.trackTitle || `OnChain ID: ${trackId}`}</TableCell>
                                        <TableCell>{shareData.sharers.length}</TableCell>
                                        <TableCell>{uniqueSharers}</TableCell>
                                        <TableCell>
                                            <Button variant="contained" disabled>
                                                Distribute (WIP)
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            }) : <TableRow><TableCell colSpan={4} align="center">No shares recorded yet.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </TableContainer>
            )
        }

        return (
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Submitted</TableCell>
                            <TableCell>Artist</TableCell>
                            <TableCell>Title</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Links</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredSubmissions.map((track) => (
                            <TableRow key={track.id}>
                                <TableCell>{new Date(track.submittedAt).toLocaleString()}</TableCell>
                                <TableCell>{track.artistName} <br/> <Typography variant="caption" color="textSecondary"><code>{track.artistWallet}</code></Typography></TableCell>
                                <TableCell>{track.trackTitle}</TableCell>
                                <TableCell>{track.status}</TableCell>
                                <TableCell>
                                    <Link href={track.coverImageUrl} target="_blank" rel="noopener noreferrer">Cover</Link> | <Link href={track.videoUrl} target="_blank" rel="noopener noreferrer">Watch</Link>
                                </TableCell>
                                <TableCell>
                                    {track.status === 'pending' && (
                                        <>
                                            <Button size="small" variant="contained" color="success" onClick={() => handleStatusChange(track.id, 'approved')} sx={{ mr: 1 }}>Approve</Button>
                                            <Button size="small" variant="contained" color="warning" onClick={() => handleStatusChange(track.id, 'rejected')}>Reject</Button>
                                        </>
                                    )}
                                    {(track.status === 'rejected' || track.status === 'published') && (
                                        <Button size="small" variant="contained" color="error" onClick={() => handleDelete(track.id)}>Delete</Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        )
    };
    
    const BatchPublishModal = () => {
        // State for the modal's text field
        const [localTxHash, setLocalTxHash] = useState('');

        return (
            <Modal open={isBatchPublishModalOpen} onClose={() => setIsBatchPublishModalOpen(false)}>
                <Box sx={modalStyle}>
                    <Typography variant="h6" component="h2">Batch Publish to Smart Contract</Typography>
                    <Typography sx={{ mt: 2 }}>
                        Copy these arrays and use them as parameters for the `batchRegisterAndUpload` function in Remix.
                    </Typography>
                    
                    {batchPublishData && Object.keys(batchPublishData).map(key => (
                        <Box key={key} sx={{ mt: 2, p: 2, border: '1px solid grey', borderRadius: 1, backgroundColor: '#f5f5f5' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2"><strong>{key}:</strong></Typography>
                                <IconButton size="small" onClick={() => handleCopyToClipboard(key, batchPublishData[key])}>
                                    {copiedKey === key ? <CheckIcon color="success" /> : <ContentCopyIcon />}
                                </IconButton>
                            </Box>
                            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 150, overflowY: 'auto' }}>
                                {JSON.stringify(batchPublishData[key], null, 2)}
                            </pre>
                        </Box>
                    ))}

                    <Typography sx={{ mt: 3, mb: 1 }}>
                        After the transaction is confirmed, paste the transaction hash below to sync the database.
                    </Typography>
                    <TextField 
                        fullWidth
                        label="Transaction Hash" 
                        variant="outlined"
                        value={localTxHash}
                        onChange={(e) => setLocalTxHash(e.target.value)}
                    />
                     <Button 
                        fullWidth 
                        variant="contained" 
                        sx={{ mt: 2 }}
                        onClick={() => handleConfirmBatchPublication(localTxHash)}
                        disabled={!localTxHash || isWaitingForSyncReceipt || isSyncing}
                    >
                        {isWaitingForSyncReceipt || isSyncing ? <CircularProgress size={24} /> : 'Confirm & Sync'}
                    </Button>
                    {syncError && <Alert severity="error" sx={{ mt: 2 }}>{syncError}</Alert>}
                </Box>
            </Modal>
        )
    };

    const VoteTallyModal = () => (
        <Modal open={isVoteTallyModalOpen} onClose={() => setIsVoteTallyModalOpen(false)}>
            <Box sx={modalStyle}>
                <Typography variant="h6" component="h2">Vote Tally & Submission</Typography>
                {isTallyLoading && <CircularProgress />}
                {tallyError && <Alert severity="error">{tallyError}</Alert>}
                {voteTally && stats.unprocessedVotes > 0 ? (
                    <>
                        <Typography sx={{ mt: 2 }}>
                            Use this data to call `adminBatchVote` in Remix. After the transaction is confirmed, click the button below to mark the votes as tallied.
                        </Typography>
                         <Box sx={{ mt: 2, p: 2, border: '1px solid grey', borderRadius: 1, backgroundColor: '#f5f5f5' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2"><strong>Track IDs (trackIds):</strong></Typography>
                                <IconButton size="small" onClick={() => handleCopyToClipboard('tallyTrackIds', tallyTrackIds)}>
                                    {copiedKey === 'tallyTrackIds' ? <CheckIcon color="success" /> : <ContentCopyIcon />}
                                </IconButton>
                            </Box>
                            <Typography variant="body1" sx={{ mt: 2, fontFamily: 'monospace', whiteSpace: 'pre-wrap', bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                                {JSON.stringify(tallyTrackIds, null, 2)}
                            </Typography>
                        </Box>
                         <Box sx={{ mt: 2, p: 2, border: '1px solid grey', borderRadius: 1, backgroundColor: '#f5f5f5' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2"><strong>Vote Counts (voteCounts):</strong></Typography>
                                <IconButton size="small" onClick={() => handleCopyToClipboard('tallyVoteCounts', tallyVoteCounts)}>
                                    {copiedKey === 'tallyVoteCounts' ? <CheckIcon color="success" /> : <ContentCopyIcon />}
                                </IconButton>
                            </Box>
                            <Typography variant="body1" sx={{ mt: 2, fontFamily: 'monospace', whiteSpace: 'pre-wrap', bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                                {JSON.stringify(tallyVoteCounts, null, 2)}
                            </Typography>
                        </Box>
                        <Button 
                            variant="contained" 
                            color="primary" 
                            onClick={handleMarkVotesTallied}
                            disabled={isMarkingTallied}
                            sx={{ mt: 2 }}
                        >
                            {isMarkingTallied ? <CircularProgress size={24} /> : "Confirm & Mark Votes Tallied"}
                        </Button>
                    </>
                ) : (
                    <Typography sx={{ mt: 2 }}>No unprocessed votes to tally.</Typography>
                )}
            </Box>
        </Modal>
    );

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
                    <Button variant="contained" color="secondary" onClick={openBatchPublishModal} disabled={stats.approved === 0}>
                        Publish Approved ({stats.approved})
                    </Button>
                    <Button variant="contained" color="success" onClick={() => setIsVoteTallyModalOpen(true)} disabled={stats.unprocessedVotes === 0}>
                        Tally Votes ({stats.unprocessedVotes})
                    </Button>
                </Box>
            </Box>
            
            {renderContent()}
            <BatchPublishModal />
            <VoteTallyModal />
        </Container>
    );
};

export default AdminPage; 