import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Track } from '../types';
import { Container, Typography, CircularProgress, Grid, Alert } from '@mui/material';
import TrackCard from './TrackCard';

const VotingPage: React.FC = () => {
    const [publishedTracks, setPublishedTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPublishedTracks = async () => {
            try {
                setLoading(true);
                const response = await api.get('/submissions?status=published');
                const tracks = response.data?.tracks || [];
                if (Array.isArray(tracks)) {
                    setPublishedTracks(tracks);
                } else {
                    console.error("Expected an array of tracks, but received:", response.data);
                    throw new Error("Invalid data format from server.");
                }
            } catch (err) {
                console.error("Failed to fetch published tracks:", err);
                setError("Could not load tracks for voting. Please try again later.");
            } finally {
                setLoading(false);
            }
        };

        fetchPublishedTracks();
    }, []);

    if (loading) {
        return <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Container>;
    }

    if (error) {
        return <Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom component="h1">
                Vote for the Next Hit
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Cast your vote to support your favorite artist. The track with the most votes at the end of the week wins.
            </Typography>
            
            {publishedTracks.length > 0 ? (
                <Grid container spacing={4}>
                    {publishedTracks.map((track) => (
                        <Grid item key={track.onChainTrackId || track.id} xs={12} sm={6} md={4}>
                            <TrackCard track={track} />
                        </Grid>
                    ))}
                </Grid>
            ) : (
                <Alert severity="info" sx={{ mt: 4 }}>
                    No tracks are currently available for voting. Check back soon!
                </Alert>
            )}
        </Container>
    );
};

export default VotingPage;
