import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Container, Typography, Grid, CircularProgress, Alert, Button } from '@mui/material';
import api from '../services/api';
import { Track } from '../types';
import TrackCard from './TrackCard';

const GenrePage: React.FC = () => {
    const { genreName } = useParams<{ genreName: string }>();
    const [tracks, setTracks] = useState<Track[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!genreName) return;

        const fetchGenreTracks = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await api.get(`/genre/${genreName}`);
                setTracks(response.data);
            } catch (err) {
                setError(`Failed to load tracks for ${genreName}. Please try again later.`);
                console.error(`Error fetching tracks for genre ${genreName}:`, err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchGenreTracks();
    }, [genreName]);

    const handleTrackDelete = (deletedTrackId: string) => {
        setTracks(prevTracks => 
            prevTracks.filter(track => track.id !== deletedTrackId)
        );
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ textTransform: 'capitalize' }}>
                Top 50 in {genreName}
            </Typography>
            
            <Button component={Link} to="/" variant="outlined" sx={{ mb: 4 }}>
                &larr; Back to Home
            </Button>

            {isLoading ? (
                <Grid container justifyContent="center"><CircularProgress /></Grid>
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : tracks.length === 0 ? (
                <Alert severity="info">No tracks found for this genre yet. Be the first to upload!</Alert>
            ) : (
                <Grid container spacing={4}>
                    {tracks.map(track => (
                        <Grid item key={track.id} xs={12} sm={6} md={4}>
                           <TrackCard track={track} onDelete={handleTrackDelete} />
                        </Grid>
                    ))}
                </Grid>
            )}
        </Container>
    );
};

export default GenrePage; 