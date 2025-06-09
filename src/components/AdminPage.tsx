import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Track } from '../types';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { AXEP_VOTING_CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI } from 'config';
import { parseEventLogs } from 'viem';
import {
    Container, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button,
    Modal, Box, Typography, TextField, CircularProgress, Card, CardContent, Grid, Link, TextareaAutosize, Alert, IconButton
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

// Combined component for the Admin Page
const AdminPage: React.FC = () => {
    // State for submissions
    const [submissions, setSubmissions] = useState<Track[]>([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState<Track[]>([]);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'published' | 'shares'>('all');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // State for Batch Publishing Modal
    const [isBatchPublishModalOpen, setIsBatchPublishModalOpen] = useState(false);
    const [batchPublishData, setBatchPublishData] = useState<Record<string, any> | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [tempTxHash, setTempTxHash] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    // State for Share Rewards
    const [sharesByTrack, setSharesByTrack] = useState<{ [trackId: string]: any[] }>({});
    const [isSharesLoading, setIsSharesLoading] = useState<boolean>(true);
    
    // Wagmi hooks for contract interaction
    const { data: hash, writeContract, isPending, error: contractError } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
    const { data: syncReceipt, isLoading: isWaitingForSyncReceipt, isSuccess: syncReceiptConfirmed } = useWaitForTransactionReceipt({ 
        hash: tempTxHash ? tempTxHash as `0x${string}` : undefined,
    });

    // Data fetching
    const fetchSubmissions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/submissions');
            const tracksData: Track[] = res.data?.tracks && Array.isArray(res.data.tracks) ? res.data.tracks : (Array.isArray(res.data) ? res.data : []);
            const sortedSubmissions = tracksData.sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
            setSubmissions(sortedSubmissions);
        } catch (err) {
            console.error("Failed to fetch submissions:", err);
            setError("Failed to load submissions. Please try refreshing the page.");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchShares = useCallback(async () => {
        setIsSharesLoading(true);
        try {
            const res = await api.get('/shares-by-track');
            setSharesByTrack(res.data);
        } catch (err) {
            console.error("Failed to fetch shares:", err);
        } finally {
            setIsSharesLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubmissions();
        fetchShares();
    }, [fetchSubmissions, fetchShares]);

    // Filtering logic
    useEffect(() => {
        if (filter === 'shares') {
            setFilteredSubmissions([]);
        } else if (filter === 'all') {
            setFilteredSubmissions(submissions);
        } else {
            setFilteredSubmissions(submissions.filter(s => s.status === filter));
        }
    }, [filter, submissions]);
    
    // Memoized stats
    const stats = React.useMemo(() => ({
        total: submissions.length,
        pending: submissions.filter(s => s.status === 'pending').length,
        approved: submissions.filter(s => s.status === 'approved').length,
        rejected: submissions.filter(s => s.status === 'rejected').length,
        published: submissions.filter(s => s.status === 'published').length,
    }), [submissions]);

    // Handlers
    const handleStatusChange = async (id: string, status: 'approved' | 'rejected') => {
        try {
            await api.patch(`/submissions/${id}`, { status });
            fetchSubmissions();
        } catch (err) {
            alert(`Error updating status for submission ${id}.`);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this submission?')) {
            try {
                await api.delete(`/submissions/${id}`);
                fetchSubmissions();
            } catch (err) {
                alert(`Error deleting submission ${id}.`);
            }
        }
    };
    
    const openBatchPublishModal = async () => {
        try {
            const response = await api.get('/submissions/approved-for-publishing');
            const tracksToPublish = response.data.tracks;
            if (tracksToPublish?.length > 0) {
                const formattedData = {
                    artistWallets: tracksToPublish.map((t: Track) => t.artistWallet),
                    artistNames: tracksToPublish.map((t: Track) => t.artistName),
                    trackTitles: tracksToPublish.map((t: Track) => t.trackTitle),
                    genres: tracksToPublish.map((t: Track) => t.genre),
                    videoUrls: tracksToPublish.map((t: Track) => t.videoUrl),
                    coverImageUrls: tracksToPublish.map((t: Track) => t.coverImageUrl),
                };
                setBatchPublishData(formattedData);
                setIsBatchPublishModalOpen(true);
            } else {
                alert('No approved tracks are ready for publishing.');
            }
        } catch (err) {
            alert('Failed to fetch tracks for batch publishing.');
        }
    };

    const handleCopyToClipboard = (key: string, data: any) => {
        const dataString = JSON.stringify(data);
        navigator.clipboard.writeText(dataString);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000); // Reset after 2 seconds
    };

    const handleConfirmBatchPublication = async (transactionHash: string) => {
        if (!transactionHash.startsWith('0x') || transactionHash.length !== 66) {
            alert('Please enter a valid transaction hash (0x...).');
            return;
        }
        setTempTxHash(transactionHash);
    };
    
    const handleSyncOnChainData = useCallback(async (receipt: any) => {
        if (!receipt) return;
        setIsSyncing(true);
        setSyncError(null);
        try {
            const logs = parseEventLogs({
                abi: AXEP_VOTING_CONTRACT_ABI,
                logs: receipt.logs,
                eventName: 'TrackUploaded'
            });

            const updatedTracks = logs.map(log => ({
                onChainTrackId: log.args.trackId.toString(),
                artistId: log.args.artistId.toString(),
                videoUrl: log.args.videoUrl, 
            }));

            if (updatedTracks.length > 0) {
                await api.post('/submissions/sync-onchain', { tracks: updatedTracks });
                alert('On-chain data synchronized successfully!');
                setIsBatchPublishModalOpen(false);
                setTempTxHash('');
                fetchSubmissions(); // Refetch to get updated 'published' status and on-chain IDs
            } else {
                setSyncError("No 'TrackUploaded' events found in this transaction. Please check the transaction hash and contract address.");
            }
        } catch (err) {
            console.error("Failed to sync on-chain data:", err);
            setSyncError("An error occurred during sync. See console for details.");
        } finally {
            setIsSyncing(false);
        }
    }, [fetchSubmissions]);

    useEffect(() => {
        if (syncReceipt) {
            handleSyncOnChainData(syncReceipt);
        }
    }, [syncReceipt, handleSyncOnChainData]);
    
    const handleDistributeRewards = (trackId: string) => {
        const shares = sharesByTrack[trackId];
        if (!shares || shares.length === 0) return;
        const recipients = [...new Set(shares.map(s => s.walletAddress))];
        writeContract({
            address: AXEP_VOTING_CONTRACT_ADDRESS,
            abi: AXEP_VOTING_CONTRACT_ABI,
            functionName: 'batchDistributeShareRewards',
            args: [BigInt(trackId), recipients],
        });
    };
    
    const trackIdToTitle = React.useMemo(() => submissions.reduce((acc: Record<string, string>, track) => {
        acc[track.id] = track.trackTitle;
        return acc;
    }, {}), [submissions]);

    // Render logic
    if (loading) return <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Container>;
    if (error) return <Container sx={{ color: 'red', textAlign: 'center', mt: 4 }}>{error}</Container>;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>Admin Dashboard</Typography>
            
            <Grid container spacing={2} sx={{ mb: 4 }}>
                {Object.entries(stats).map(([key, value]) => (
                    <Grid item xs={12} sm={6} md={2.4} key={key}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>{key}</Typography>
                                <Typography variant="h4">{value}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Box>
                    {(['all', 'pending', 'approved', 'rejected', 'published', 'shares'] as const).map(f => (
                        <Button key={f} variant={f === filter ? "contained" : "outlined"} onClick={() => setFilter(f)} sx={{ mr: 1 }}>
                            {f === 'shares' ? 'Share Rewards' : f.charAt(0).toUpperCase() + f.slice(1)}
                        </Button>
                    ))}
                </Box>
                 <Button variant="contained" color="secondary" onClick={openBatchPublishModal} disabled={stats.approved === 0}>
                    Batch Publish ({stats.approved}) Approved Tracks
                </Button>
            </Box>
            
            {/* Conditional Rendering of Tables */}
            {filter === 'shares' ? (
                <Box>
                    {isSharesLoading || loading ? <CircularProgress /> :
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
                                {Object.keys(sharesByTrack).length > 0 ? Object.keys(sharesByTrack).map((trackId) => {
                                    const shares = sharesByTrack[trackId] || [];
                                    const uniqueSharers = new Set(shares.map(s => s.walletAddress)).size;
                                    return (
                                        <TableRow key={trackId}>
                                            <TableCell>{trackIdToTitle[trackId] || `Track ID: ${trackId}`}</TableCell>
                                            <TableCell>{shares.length}</TableCell>
                                            <TableCell>{uniqueSharers}</TableCell>
                                            <TableCell>
                                                <Button variant="contained" onClick={() => handleDistributeRewards(trackId)} disabled={isPending || shares.length === 0}>
                                                    {isPending ? 'Distributing...' : 'Distribute Rewards'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                }) : <TableRow><TableCell colSpan={4} align="center">No shares recorded yet.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    }
                    {isConfirming && <Alert severity="info" sx={{ mt: 2 }}>Waiting for transaction confirmation...</Alert>}
                    {isConfirmed && <Alert severity="success" sx={{ mt: 2 }}>Rewards distributed successfully!</Alert>}
                    {contractError && <Alert severity="error" sx={{ mt: 2 }}>Error: {contractError.message}</Alert>}
                </Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Submitted</TableCell>
                                <TableCell>Artist</TableCell>
                                <TableCell>Title</TableCell>
                                <TableCell>Genre</TableCell>
                                <TableCell>Links</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredSubmissions.map((track) => (
                                <TableRow key={track.id}>
                                    <TableCell>{new Date(track.submissionDate).toLocaleString()}</TableCell>
                                    <TableCell>{track.artistName} <br/> <small><code>{track.artistWallet}</code></small></TableCell>
                                    <TableCell>{track.trackTitle}</TableCell>
                                    <TableCell>{track.genre}</TableCell>
                                    <TableCell>
                                        <Link href={track.coverImageUrl} target="_blank" rel="noopener noreferrer">Cover</Link> | <Link href={track.videoUrl} target="_blank" rel="noopener noreferrer">Video</Link>
                                    </TableCell>
                                    <TableCell>{track.status}</TableCell>
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
            )}

            {/* Batch Publish Modal */}
            <Modal
                open={isBatchPublishModalOpen}
                onClose={() => {
                    setIsBatchPublishModalOpen(false);
                    setTempTxHash('');
                    setSyncError(null);
                }}
                aria-labelledby="batch-publish-modal-title"
                aria-describedby="batch-publish-modal-description"
            >
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: 600, bgcolor: 'background.paper', border: '2px solid #000', boxShadow: 24, p: 4, maxHeight: '90vh', overflowY: 'auto' }}>
                    <Typography id="batch-publish-modal-title" variant="h6" component="h2">
                        Batch Publish Approved Tracks
                    </Typography>
                    
                    <Typography sx={{ mt: 2 }}>
                        1. Copy the data from each box below and paste it into the corresponding field in the 'batchRegisterAndUpload' function in Remix.
                    </Typography>

                    {batchPublishData && Object.entries(batchPublishData).map(([key, value]) => (
                        <Box key={key} sx={{ mt: 2, position: 'relative' }}>
                            <Typography variant="caption" sx={{ textTransform: 'capitalize', fontWeight: 'bold' }}>
                                 {key.replace(/([A-Z])/g, ' $1').trim()}
                            </Typography>
                            <TextField
                                fullWidth
                                multiline
                                value={JSON.stringify(value)}
                                variant="outlined"
                                size="small"
                                InputProps={{
                                    readOnly: true,
                                }}
                                sx={{
                                    '& .MuiInputBase-input': {
                                        fontFamily: 'monospace',
                                        fontSize: '0.9rem',
                                        whiteSpace: 'pre-wrap', 
                                        wordBreak: 'break-all',
                                    },
                                }}
                            />
                            <IconButton
                                onClick={() => handleCopyToClipboard(key, value)}
                                size="small"
                                sx={{ position: 'absolute', top: 28, right: 8 }}
                            >
                                {copiedKey === key ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
                            </IconButton>
                        </Box>
                    ))}
                    
                    <Typography sx={{ mt: 4, pt: 2, borderTop: '1px solid grey' }}>
                        2. After executing the transaction, paste the transaction hash below to sync the data.
                    </Typography>

                    <TextField
                        fullWidth
                        label="Transaction Hash"
                        variant="outlined"
                        value={tempTxHash}
                        onChange={(e) => setTempTxHash(e.target.value)}
                        sx={{ mt: 1 }}
                        disabled={isWaitingForSyncReceipt || isSyncing}
                    />
                    
                    <Button
                        onClick={() => handleConfirmBatchPublication(tempTxHash)}
                        sx={{ mt: 2 }}
                        variant="contained"
                        disabled={!tempTxHash || isWaitingForSyncReceipt || isSyncing}
                    >
                        {isWaitingForSyncReceipt || isSyncing ? <CircularProgress size={24} /> : "Confirm & Sync"}
                    </Button>

                    {(isWaitingForSyncReceipt || isSyncing) && <Typography sx={{mt: 1}}>Waiting for transaction confirmation...</Typography>}
                    {syncReceiptConfirmed && <Alert severity="success" sx={{mt: 1}}>Transaction confirmed! Syncing data...</Alert>}
                    {syncError && <Alert severity="error" sx={{mt: 1}}>{syncError}</Alert>}
                </Box>
            </Modal>
        </Container>
    );
};

export default AdminPage; 