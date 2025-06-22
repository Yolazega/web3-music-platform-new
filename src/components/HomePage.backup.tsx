import React, { useState, useEffect } from 'react';
import { Container, Typography, Grid, Card, CardContent, CardMedia, Button, Box, CircularProgress, Alert } from '@mui/material';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Track } from '../types'; 
import WinnerCard from './WinnerCard';

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
                AXEP | Decentralized Music Voting
            </Typography>
            
            <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 4, color: 'text.secondary' }}>
                Vote for your favorite tracks, share on social media, and earn AXP tokens
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
                            <WinnerCard winner={mainWinner} />
                        ) : !isLoading && (
                            <Typography variant="h6">No overall winner yet.</Typography>
                        )}
                    </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Ready to Participate?
                        </Typography>
                        
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <Button 
                                component={Link} 
                                to="/voting" 
                                variant="contained" 
                                color="primary"
                                size="large" 
                                sx={{ py: 2, px: 4, fontSize: '1.1rem' }}
                            >
                                Vote Now
                            </Button>
                            
                            <Button 
                                component={Link} 
                                to="/upload" 
                                variant="outlined" 
                                color="primary"
                                size="large" 
                                sx={{ py: 2, px: 4, fontSize: '1.1rem' }}
                            >
                                Submit Track
                            </Button>
                        </Box>
                        
                        <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 400 }}>
                            Connect your wallet to vote for tracks, submit your music, and earn AXP tokens through social sharing.
                        </Typography>
                    </Box>
                </Grid>
            </Grid>
        </Container>
    );
};

export default HomePage; 