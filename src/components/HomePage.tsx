import React from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import { Construction, MusicNote } from '@mui/icons-material';

const HomePage: React.FC = () => {
    return (
        <Container maxWidth="md" sx={{ 
            minHeight: '80vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            textAlign: 'center'
        }}>
            <Box sx={{ 
                p: 6, 
                borderRadius: 4, 
                backgroundColor: 'background.paper',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                {/* Logo/Icon Section */}
                <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
                    <MusicNote sx={{ fontSize: 48, color: 'primary.main' }} />
                    <Construction sx={{ fontSize: 48, color: 'warning.main' }} />
                </Box>

                {/* Main Title */}
                <Typography 
                    variant="h2" 
                    component="h1" 
                    gutterBottom 
                    sx={{ 
                        fontWeight: 'bold',
                        background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        mb: 3
                    }}
                >
                    AXEP
                </Typography>

                {/* Under Construction Message */}
                <Typography 
                    variant="h4" 
                    component="h2" 
                    gutterBottom 
                    sx={{ 
                        fontWeight: 500,
                        color: 'text.primary',
                        mb: 3
                    }}
                >
                    Under Construction
                </Typography>

                {/* Description */}
                <Typography 
                    variant="h6" 
                    color="text.secondary" 
                    sx={{ 
                        mb: 4,
                        maxWidth: 500,
                        mx: 'auto',
                        lineHeight: 1.6
                    }}
                >
                    We're building something amazing. Our platform will be launching soon with exciting new features.
                </Typography>

                {/* Loading Animation */}
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 3 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body1" color="text.secondary">
                        Working hard to bring you the best experience...
                    </Typography>
                </Box>

                {/* Contact Info */}
                <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                        mt: 4,
                        fontStyle: 'italic'
                    }}
                >
                    Stay tuned for updates
                </Typography>
            </Box>
        </Container>
    );
};

export default HomePage;
