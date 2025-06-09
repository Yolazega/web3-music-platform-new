import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Track } from '../types'; 
import {
    Container,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    Modal,
    Box,
    Typography,
    TextField,
    CircularProgress,
    Card,
    CardContent,
    Grid,
    Link,
    TextareaAutosize
} from '@mui/material';

interface RewardStats {
    totalShares: number;
    totalWallets: number;
    totalTokens: number;
}

const AdminPage: React.FC = () => {
    const [submissions, setSubmissions] = useState<Track[]>([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState<Track[]>([]);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'published'>('all');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    
    const [isBatchPublishModalOpen, setIsBatchPublishModalOpen] = useState(false);
    const [batchPublishTracks, setBatchPublishTracks] = useState<Track[]>([]);
    const [batchPublishTxHashes, setBatchPublishTxHashes] = useState<{[key: string]: string}>({});

    const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
    const [rewardBatch, setRewardBatch] = useState<any>(null);
    const [rewardStats, setRewardStats] = useState<RewardStats | null>(null);

    const fetchSubmissions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/submissions');
            const tracksData: Track[] = res.data?.tracks && Array.isArray(res.data.tracks) 
                ? res.data.tracks 
                : (Array.isArray(res.data) ? res.data : []);

            const sortedSubmissions = tracksData.sort((a, b) => 
                new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
            );
            setSubmissions(sortedSubmissions);
        } catch (err) {
            console.error("Failed to fetch submissions:", err);
            setError("Failed to load submissions. Please try refreshing the page.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    useEffect(() => {
        if (filter === 'all') {
            setFilteredSubmissions(submissions);
        } else {
            setFilteredSubmissions(submissions.filter(s => s.status === filter));
        }
    }, [filter, submissions]);

    const stats = {
        total: submissions.length,
        pending: submissions.filter(s => s.status === 'pending').length,
        approved: submissions.filter(s => s.status === 'approved').length,
        rejected: submissions.filter(s => s.status === 'rejected').length,
        published: submissions.filter(s => s.status === 'published').length,
    };

    const handleStatusChange = async (id: string, status: 'approved' | 'rejected') => {
        try {
            await api.patch(`/submissions/${id}`, { status });
            fetchSubmissions();
        } catch (err) {
            console.error(`Failed to ${status} submission:`, err);
            alert(`Error updating status for submission ${id}.`);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this submission permanently?')) {
            try {
                await api.delete(`/submissions/${id}`);
                fetchSubmissions();
            } catch (err) {
                console.error('Failed to delete submission:', err);
                alert(`Error deleting submission ${id}.`);
            }
        }
    };
    
    const openBatchPublishModal = async () => {
        try {
            const response = await api.get('/submissions/approved-for-publishing');
            if (response.data.tracks && response.data.tracks.length > 0) {
                setBatchPublishTracks(response.data.tracks);
                setBatchPublishTxHashes({});
                setIsBatchPublishModalOpen(true);
            } else {
                alert('No approved tracks are ready for publishing.');
            }
        } catch (err) {
            console.error('Failed to fetch tracks for batch publishing', err);
            alert('Failed to fetch tracks for batch publishing. See console for details.');
        }
    };

    const handleBatchTxHashChange = (id: string, hash: string) => {
        setBatchPublishTxHashes(prev => ({ ...prev, [id]: hash }));
    };

    const handleConfirmSinglePublication = async (id: string) => {
        const transactionHash = batchPublishTxHashes[id];
        if (!transactionHash || !transactionHash.startsWith('0x')) {
            alert('Please enter a valid transaction hash (starting with 0x).');
            return;
        }
        try {
            await api.post(`/submissions/${id}/confirm-publication`, { transactionHash });
            alert(`Publication confirmed for track ${id}!`);
            setBatchPublishTracks(prev => prev.filter(track => track.id !== id));
            fetchSubmissions();
        } catch (err) {
            console.error('Failed to confirm publication', err);
            alert('Failed to confirm publication. See console for details.');
        }
    };

    const handleOpenRewardModal = async () => {
        try {
            const response = await api.get('/rewards-batch');
            setRewardBatch(response.data.csv);
            setRewardStats({
                totalShares: response.data.totalShares,
                totalWallets: response.data.totalWallets,
                totalTokens: response.data.totalTokens,
            });
            setIsRewardModalOpen(true);
        } catch (err) {
            console.error('Failed to fetch rewards batch', err);
            alert('Failed to fetch rewards batch. See console for details.');
        }
    };

    const handleClearShares = async () => {
        if (window.confirm('Are you sure you have successfully distributed the tokens and want to clear the share records? This cannot be undone.')) {
            try {
                await api.delete('/shares');
                alert('Share records cleared successfully!');
                setIsRewardModalOpen(false);
                setRewardBatch(null);
                setRewardStats(null);
            } catch (err) {
                console.error('Failed to clear shares', err);
                alert('Failed to clear shares. See console for details.');
            }
        }
    };

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
                    {(['all', 'pending', 'approved', 'rejected', 'published'] as const).map(f => (
                        <Button key={f} variant={f === filter ? "contained" : "outlined"} onClick={() => setFilter(f)} sx={{ mr: 1 }}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </Button>
                    ))}
                </Box>
                 <Button variant="contained" color="secondary" onClick={openBatchPublishModal} disabled={stats.approved === 0}>
                    Batch Publish ({stats.approved}) Approved Tracks
                </Button>
                <Button variant="contained" color="primary" onClick={handleOpenRewardModal} sx={{ ml: 2 }}>
                    Process Reward Payouts
                </Button>
            </Box>

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
                                <TableCell>{new Date(track.submittedAt).toLocaleString()}</TableCell>
                                <TableCell>{track.artistName}</TableCell>
                                <TableCell>{track.trackTitle}</TableCell>
                                <TableCell>{track.genre}</TableCell>
                                <TableCell>
                                    <Link href={track.coverImageUrl} target="_blank" rel="noopener noreferrer">Cover</Link>
                                    <Typography component="span" sx={{ mx: 1 }}>|</Typography>
                                    <Link href={track.videoUrl} target="_blank" rel="noopener noreferrer">Video</Link>
                                </TableCell>
                                <TableCell sx={{ textTransform: 'capitalize' }}>{track.status}</TableCell>
                                <TableCell>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1}}>
                                        {track.status === 'pending' && (
                                            <Box sx={{ display: 'flex', gap: 1}}>
                                                <Button variant="contained" size="small" color="success" onClick={() => handleStatusChange(track.id, 'approved')}>Approve</Button>
                                                <Button variant="contained" size="small" color="warning" onClick={() => handleStatusChange(track.id, 'rejected')}>Reject</Button>
                                            </Box>
                                        )}
                                        <Button variant="outlined" size="small" color="error" onClick={() => handleDelete(track.id)}>
                                            Delete
                                        </Button>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Modal open={isBatchPublishModalOpen} onClose={() => setIsBatchPublishModalOpen(false)}>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', maxWidth: '1000px', bgcolor: 'background.paper', border: '2px solid #000', boxShadow: 24, p: 4, maxHeight: '90vh', overflowY: 'auto' }}>
                    <Typography variant="h6" component="h2">Batch Publish Approved Tracks</Typography>
                    <Typography sx={{ mt: 2 }}>
                        For each track below, go to Remix, call the `registerArtistAndUploadFirstTrack` function with the provided parameters. After submitting the transaction, paste the transaction hash and click "Confirm Publication".
                    </Typography>
                    {batchPublishTracks.map((track, index) => (
                        <Paper key={track.id} sx={{ p: 2, my: 2, backgroundColor: '#f5f5f5' }}>
                            <Typography variant="h6">Track {index + 1}: {track.trackTitle}</Typography>
                            <Box sx={{ fontFamily: 'monospace', my: 1, p:1, bgcolor: '#e0e0e0', borderRadius: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                <p>artistName (string): {track.artistName}</p>
                                <p>trackTitle (string): {track.trackTitle}</p>
                                <p>genre (string): {track.genre}</p>
                                <p>videoUrl (string): {track.videoUrl}</p>
                                <p>coverImageUrl (string): {track.coverImageUrl}</p>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                                <TextField label="Transaction Hash (0x...)" variant="outlined" fullWidth value={batchPublishTxHashes[track.id] || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleBatchTxHashChange(track.id, e.target.value)} />
                                <Button variant="contained" onClick={() => handleConfirmSinglePublication(track.id)}>
                                    Confirm Publication
                                </Button>
                            </Box>
                        </Paper>
                    ))}
                </Box>
            </Modal>
            
            {/* Rewards Payout Modal */}
            <Modal open={isRewardModalOpen} onClose={() => setIsRewardModalOpen(false)}>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', maxWidth: '1000px', bgcolor: 'background.paper', border: '2px solid #000', boxShadow: 24, p: 4, maxHeight: '90vh', overflowY: 'auto' }}>
                    <Typography variant="h6" component="h2">Process Weekly Reward Payouts</Typography>
                    
                    {rewardStats && (
                        <Box sx={{ my: 2, p: 2, bgcolor: 'primary.light', color: 'primary.contrastText', borderRadius: 1 }}>
                            <Typography variant="h6">Batch Summary</Typography>
                            <Typography>Total Shares: {rewardStats.totalShares}</Typography>
                            <Typography>Unique Wallets: {rewardStats.totalWallets}</Typography>
                            <Typography>Total AXP to Distribute: {rewardStats.totalTokens}</Typography>
                        </Box>
                    )}

                    <Typography sx={{ mt: 2 }}>
                        Use a multisender dApp (like <Link href="https://app.disperse.app/" target="_blank">Disperse.app</Link> or the one in Gnosis Safe) to distribute the rewards. Copy the data below and paste it into the dApp's CSV/text input.
                    </Typography>

                    <TextareaAutosize
                        minRows={10}
                        readOnly
                        value={rewardBatch || 'No rewards to process.'}
                        style={{ width: '100%', marginTop: '1rem', fontFamily: 'monospace', whiteSpace: 'pre' }}
                    />
                    
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        <Button variant="outlined" onClick={() => setIsRewardModalOpen(false)}>Close</Button>
                        <Button 
                            variant="contained" 
                            color="success" 
                            onClick={handleClearShares}
                            disabled={!rewardBatch}
                        >
                            Confirm Payout & Clear Shares
                        </Button>
                    </Box>
                </Box>
            </Modal>
        </Container>
    );
};

export default AdminPage;