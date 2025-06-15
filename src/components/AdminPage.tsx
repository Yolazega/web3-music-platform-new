import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Track, Share, Vote } from '../types';
import {
    Container, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button,
    CircularProgress, Card, CardContent, Grid, Alert, Box, Typography, Link
} from '@mui/material';

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
    const [isPublishingAll, setIsPublishingAll] = useState<boolean>(false);

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
        approved: submissions.filter(s => s.status === 'approved').length,
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
    
    const handlePublishWeekly = async () => {
        if (!window.confirm("Are you sure you want to publish all approved uploads from the previous week? This will make them live.")) {
            return;
        }
        setIsPublishing(true);
        try {
            const res = await api.post('/admin/publish-weekly-uploads');
            alert(res.data.message);
            fetchAllData();
        } catch (err: any) {
            alert(err.response?.data?.error || "An error occurred during publishing.");
            console.error(err);
        } finally {
            setIsPublishing(false);
        }
    };

    const handlePublishAll = async () => {
        if (!window.confirm("Are you sure you want to publish ALL approved uploads immediately? This is for testing and will make them live.")) {
            return;
        }
        setIsPublishingAll(true);
        try {
            const res = await api.post('/admin/publish-all-approved');
            alert(res.data.message);
            fetchAllData();
        } catch (err: any) {
            alert(err.response?.data?.error || "An error occurred during publishing.");
            console.error(err);
        } finally {
            setIsPublishingAll(false);
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
            
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    {(['all', 'pending', 'approved', 'rejected', 'published'] as const).map(f => (
                        <Button key={f} variant={f === filter ? "contained" : "outlined"} onClick={() => setFilter(f)} sx={{ mr: 1, mb: 1 }}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </Button>
                    ))}
                </Box>
                <Button variant="contained" color="secondary" onClick={handlePublishWeekly} disabled={isPublishing || stats.approved === 0}>
                    {isPublishing ? <CircularProgress size={24} /> : `Publish ${stats.approved} Approved Tracks`}
                </Button>
                <Button variant="contained" color="warning" onClick={handlePublishAll} disabled={isPublishingAll || stats.approved === 0} sx={{ ml: 2 }}>
                    {isPublishingAll ? <CircularProgress size={24} /> : `Publish All (Test)`}
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
        </Container>
    );
};

export default AdminPage; 