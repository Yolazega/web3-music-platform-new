import React, { useState, useEffect } from 'react';
import { Container, Typography, Grid, Card, CardContent, CardMedia, Button, Box, CircularProgress, Alert } from '@mui/material';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Track } from '../types'; 

// --- Component for a single Genre Winner ---
interface GenreWinnerCardProps {
    genre: string;
    track: Track;
}

const GenreWinnerCard: React.FC<GenreWinnerCardProps> = ({ genre, track }) => {
    return (
        <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid #ddd' }}>
            <CardMedia
                component="img"
                height="200"
                image={track.coverImageUrl || 'https://placehold.co/200'}
                alt={`Cover for ${track.title}`}
            />
            <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                    {genre.toUpperCase()}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    {track.artist} - "{track.title}"
                </Typography>
                <Typography variant="body2" color="primary">
                    Votes: {track.votes.toLocaleString()}
                </Typography>
            </CardContent>
        </Card>
    );
};

// --- Main Home Page Component ---
const HomePage: React.FC = () => {
    const [topTracks, setTopTracks] = useState<{ [genre: string]: Track }>({});
    const [mainWinner, setMainWinner] = useState<Track | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHomePageData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [topByGenreRes, mainWinnerRes] = await Promise.all([
                    api.get('/tracks/top-by-genre'),
                    api.get('/tracks/overall-winner')
                ]);
                setTopTracks(topByGenreRes.data);
                setMainWinner(mainWinnerRes.data);
            } catch (err) {
                setError('Failed to load the top tracks. Please try again later.');
                console.error('Error fetching homepage data:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHomePageData();
    }, []);

    const genres = ["Pop", "Soul", "Rock", "Country", "RAP"];

    return (
        <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
                VOTE SHARE CLAIM
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4, maxWidth: '600px', mx: 'auto' }}>
                Axep is a Web3-based music platform that rewards both artists and fans. The platform democratizes online casting by issuing tokens as rewards for social media activity. The goal is to reduce the dominant role of major music labels and provide artists and supporters with direct benefits from their engagement.
            </Typography>
             <Typography variant="body1" sx={{ fontStyle: 'italic', mb: 4 }}>
                "The times when fans did not participate in the success of the artists they supported are over."
            </Typography>

            {/* --- Genre Winners Section --- */}
            <Grid container spacing={4} sx={{ mb: 6 }}>
                {isLoading ? (
                    <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center' }}>
                        <CircularProgress />
                    </Grid>
                ) : error ? (
                    <Grid item xs={12}>
                        <Alert severity="error">{error}</Alert>
                    </Grid>
                ) : (
                    genres.map(genre => {
                        const track = topTracks[genre];
                        return (
                            <Grid item key={genre} xs={12} sm={6} md={2.4}>
                                {track ? (
                                    <Link to={`/genre/${genre.toLowerCase()}`} style={{ textDecoration: 'none' }}>
                                        <GenreWinnerCard genre={genre} track={track} />
                                    </Link>
                                ) : (
                                    <Card sx={{ height: '100%', border: '1px solid #ddd' }}>
                                        <CardContent>
                                            <Typography gutterBottom variant="h6" component="div">{genre.toUpperCase()}</Typography>
                                            <Typography variant="body2" color="text.secondary">No winner yet</Typography>
                                        </CardContent>
                                    </Card>
                                )}
                            </Grid>
                        );
                    })
                )}
            </Grid>

            {/* --- Connect Wallet & Main Winner Section --- */}
            <Grid container spacing={4} alignItems="center" justifyContent="center">
                 <Grid item xs={12} md={6}>
                    <Box sx={{ p: 4, backgroundColor: '#000', color: '#fff', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                         {mainWinner ? (
                            <>
                                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>Current Main Winner</Typography>
                                <Typography variant="h6">{mainWinner.artist} - "{mainWinner.title}"</Typography>
                                <Typography>Votes: {mainWinner.votes.toLocaleString()}</Typography>
                            </>
                        ) : !isLoading && (
                            <Typography variant="h6">No overall winner yet.</Typography>
                        )}
                    </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                     {/* This section replaces the sub-winners */}
                    <Button variant="contained" size="large" sx={{ py: 2, px: 5, fontSize: '1.2rem' }}>
                        Connect Wallet
                    </Button>
                </Grid>
            </Grid>
        </Container>
    );
};

export default HomePage;
