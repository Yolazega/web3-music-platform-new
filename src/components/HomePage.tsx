import React from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';

const HomePage: React.FC = () => {
    return (
        <Container maxWidth="md">
            <Box
                sx={{
                    minHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                }}
            >
                <Typography variant="h2" component="h1" gutterBottom>
                    Axep
                </Typography>
                <Typography variant="h5" component="h2" color="text.secondary" paragraph>
                    A new era for music discovery is on the horizon.
                </Typography>
                <Typography variant="body1" paragraph>
                    Our platform is currently under construction. Stay tuned for something amazing.
                </Typography>
                <CircularProgress sx={{ mt: 4 }} />
            </Box>
        </Container>
    );
};

export default HomePage;
