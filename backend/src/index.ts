import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fileUpload, { UploadedFile } from 'express-fileupload';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentWeekNumber, isSubmissionPeriodOver } from './time';
import { uploadToPinata } from './pinata';
import { ethers } from 'ethers';
import axios from 'axios';

dotenv.config();

const app = express();

// Middleware setup
app.use(cors({
    origin: ['http://localhost:3000', 'https://axep-frontend.onrender.com', 'https://www.axepvoting.io'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    useTempFiles: true,
    tempFileDir: '/tmp/'
}) as any); // Type assertion to bypass TypeScript error
app.set('trust proxy', true);

const port = parseInt(process.env.PORT || '3001', 10);

const dataDir = process.env.RENDER_DISK_MOUNT_PATH || path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'db.json');

// --- Type Definitions ---
interface Track {
    id: string;
    title: string;
    artist: string;
    artistWallet: string;
    filePath: string;
    ipfsHash: string;
    genre: string;
    status: 'pending' | 'approved' | 'rejected' | 'published' | 'archived';
    onChainId?: number;
    votes: number;
    weekNumber: number;
    coverImageUrl?: string;
    videoUrl?: string;
    submittedAt: string;
}

interface Share {
    id: string;
    trackId: number;
    userWallet: string;
    shareUrl1: string;
    shareUrl2: string;
    status: 'pending' | 'verified' | 'rejected';
    submittedAt: string;
}

interface Vote {
    id: string;
    trackId: string;
    voterAddress: string;
    timestamp: number;
    status: 'unprocessed' | 'processed' | 'tallied';
    weekNumber: number;
}

interface Database {
    tracks: Track[];
    shares: Share[];
    votes: Vote[];
}

// --- Database Initialization ---
const initializeDatabase = async () => {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.access(dbPath);
    } catch {
        console.log('Database file not found. Creating a new one.');
        await fs.writeFile(dbPath, JSON.stringify({
            tracks: [],
            shares: [],
            votes: [],
        }, null, 2));
    }
};



// --- Test Route ---
app.get('/', (req: Request, res: Response) => {
  res.send('Hello from the Web3 Music Platform backend!');
});

// --- API Endpoints ---

// Upload a new track
app.post('/upload', async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production' && isSubmissionPeriodOver()) {
            return res.status(400).json({ error: 'The submission period for this week is over.' });
        }

        const { artist, title, artistWallet, genre } = req.body;
        console.log('Upload request received:', { artist, title, artistWallet, genre });
        
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ error: 'No files were uploaded.' });
        }

        console.log('Files received:', Object.keys(req.files));

        const coverImageFile = req.files.coverImageFile as UploadedFile;
        const videoFile = req.files.videoFile as UploadedFile;

        if (!coverImageFile || !videoFile) {
            console.error('Missing files:', { 
                hasCoverImage: !!coverImageFile, 
                hasVideo: !!videoFile 
            });
            return res.status(400).json({ error: 'Cover image and video file are required.' });
        }

        console.log('File details:', {
            coverImage: { name: coverImageFile.name, size: coverImageFile.size, type: coverImageFile.mimetype },
            video: { name: videoFile.name, size: videoFile.size, type: videoFile.mimetype }
        });
        
        const checksummedWallet = ethers.getAddress(artistWallet);

        // Upload files separately with detailed logging
        console.log('Uploading video file to Pinata...');
        const videoUrl = await uploadToPinata(videoFile);
        console.log('Video uploaded successfully:', videoUrl);

        console.log('Uploading cover image to Pinata...');
        const coverImageUrl = await uploadToPinata(coverImageFile);
        console.log('Cover image uploaded successfully:', coverImageUrl);

        // Verify URLs are different
        if (videoUrl === coverImageUrl) {
            console.error('WARNING: Video and cover image have the same URL!', { videoUrl, coverImageUrl });
        }

        const newTrack: Track = {
            id: uuidv4(),
            title,
            artist,
            artistWallet: checksummedWallet,
            filePath: '',
            ipfsHash: videoUrl.split('/').pop() || '',
            genre,
            status: 'pending',
            votes: 0,
            weekNumber: getCurrentWeekNumber(),
            submittedAt: new Date().toISOString(),
            coverImageUrl,
            videoUrl,
        };

        console.log('Track object created:', {
            id: newTrack.id,
            coverImageUrl: newTrack.coverImageUrl,
            videoUrl: newTrack.videoUrl
        });

        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        db.tracks.push(newTrack);
        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));

        console.log('Track saved to database successfully');
        res.status(201).json({ message: 'Track uploaded successfully.', track: newTrack });
    } catch (error) {
        console.error('Error uploading track:', error);
        if (error instanceof Error && error.message.includes('invalid address')) {
            return res.status(400).json({ error: 'A valid, checksummed artist wallet address is required.' });
        }
        res.status(500).json({ error: 'Failed to upload track.' });
    }
});

// Get all published tracks
app.get('/tracks', async (req, res) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const publishedTracks = db.tracks.filter((t) => t.status === 'published');
        res.json(publishedTracks);
    } catch (error) {
        console.error('Error fetching published tracks:', error);
        res.status(500).json({ error: 'Failed to fetch tracks.' });
    }
});

// Get a single track by ID
app.get('/tracks/:id', async (req, res) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const track = db.tracks.find((t) => t.id === req.params.id);
        if (track) {
            res.json(track);
        } else {
            res.status(404).json({ error: 'Track not found' });
        }
    } catch (error) {
        console.error(`Error fetching track ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch track.' });
    }
});

// Get top track by genre for homepage
app.get('/tracks/top-by-genre', async (req, res) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const publishedTracks = db.tracks.filter((t) => t.status === 'published');
        
        if (publishedTracks.length === 0) {
            return res.json({});
        }

        const genres = ["Pop", "Soul", "Rock", "Country", "RAP", "Afro / Dancehall", "Electronic", "Instrumental / Other"];
        const topByGenre: { [genre: string]: Track } = {};

        genres.forEach(genre => {
            const genreTracks = publishedTracks.filter(track => track.genre === genre);
            if (genreTracks.length > 0) {
                // Find the track with most votes in this genre
                const topTrack = genreTracks.reduce((prev, current) => 
                    (current.votes > prev.votes) ? current : prev
                );
                topByGenre[genre] = topTrack;
            }
        });

        res.json(topByGenre);
    } catch (error) {
        console.error('Error fetching top tracks by genre:', error);
        res.status(500).json({ error: 'Failed to fetch top tracks by genre.' });
    }
});

// Get overall winner (track with most votes)
app.get('/tracks/overall-winner', async (req, res) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const publishedTracks = db.tracks.filter((t) => t.status === 'published');
        
        if (publishedTracks.length === 0) {
            return res.status(404).json({ error: 'No published tracks found.' });
        }

        // Find the track with the most votes overall
        const winner = publishedTracks.reduce((prev, current) => 
            (current.votes > prev.votes) ? current : prev
        );

        res.json(winner);
    } catch (error) {
        console.error('Error fetching overall winner:', error);
        res.status(500).json({ error: 'Failed to fetch overall winner.' });
    }
});

// Handle votes
app.post('/vote', async (req, res) => {
    const { trackId, voterAddress } = req.body;
    const currentWeek = getCurrentWeekNumber();

    if (!trackId || !voterAddress) {
        return res.status(400).json({ error: 'trackId and voterAddress are required.' });
    }

    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const track = db.tracks.find((t: Track) => t.id === trackId);
        
        if (!track) return res.status(404).json({ error: 'Track not found.' });
        if (track.weekNumber !== currentWeek) return res.status(400).json({ error: 'You can only vote for tracks submitted this week.' });

        const existingVote = db.votes.find((v: Vote) => v.voterAddress === voterAddress && v.trackId === trackId && v.weekNumber === currentWeek);
        if (existingVote) return res.status(400).json({ error: 'You have already voted for this track this week.' });

        track.votes += 1;
        const newVote: Vote = {
            id: uuidv4(),
            trackId,
            voterAddress,
            timestamp: Date.now(),
            status: 'unprocessed',
            weekNumber: currentWeek
        };
        db.votes.push(newVote);

        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
        res.json({ message: 'Vote recorded successfully.', votes: track.votes });
    } catch (error) {
        console.error('Error recording vote:', error);
        res.status(500).json({ error: 'Failed to record vote.' });
    }
});

// Test file upload endpoint for debugging
app.post('/test-upload', async (req, res) => {
    try {
        console.log('=== TEST UPLOAD DEBUG ===');
        console.log('Request body keys:', Object.keys(req.body));
        console.log('Request files:', req.files ? Object.keys(req.files) : 'No files');
        
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ error: 'No files were uploaded.' });
        }

        const fileKeys = Object.keys(req.files);
        const results: any = {};

        for (const key of fileKeys) {
            const file = req.files[key] as UploadedFile;
            console.log(`File ${key}:`, {
                name: file.name,
                size: file.size,
                mimetype: file.mimetype,
                hasData: !!file.data,
                dataLength: file.data ? file.data.length : 0
            });

            // Try to upload to Pinata
            try {
                const url = await uploadToPinata(file);
                results[key] = { success: true, url };
                console.log(`${key} uploaded successfully:`, url);
            } catch (error) {
                results[key] = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
                console.error(`${key} upload failed:`, error);
            }
        }

        res.json({ message: 'Test upload completed', results });
    } catch (error) {
        console.error('Test upload error:', error);
        res.status(500).json({ error: 'Test upload failed' });
    }
});

// --- Admin Panel Endpoints ---

app.get('/admin/submissions', async (req, res) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        res.json(db.tracks);
    } catch (error) {
        console.error('Error fetching submissions for admin:', error);
        res.status(500).json({ error: 'Failed to fetch submissions.' });
    }
});

app.patch('/admin/submissions/:id', async (req, res) => {
    const { id } = req.params;
    const { status, onChainId } = req.body;

    if (!status || !['approved', 'rejected', 'published'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status provided.' });
    }
    if (status === 'published' && typeof onChainId !== 'number') {
        return res.status(400).json({ error: 'onChainId is required for published tracks.' });
    }

    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const trackIndex = db.tracks.findIndex((t: Track) => t.id === id);

        if (trackIndex === -1) return res.status(404).json({ error: 'Track not found.' });
        
        db.tracks[trackIndex].status = status;
        if (status === 'published') {
            db.tracks[trackIndex].onChainId = onChainId;
        }

        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
        res.json({ message: `Track status updated to ${status}.`, track: db.tracks[trackIndex] });
    } catch (error) {
        console.error('Error updating submission status:', error);
        res.status(500).json({ error: 'Failed to update submission status.' });
    }
});

app.get('/admin/votes', async (req, res) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        res.json(db.votes);
    } catch (error) {
        console.error('Error fetching votes for admin:', error);
        res.status(500).json({ error: 'Failed to fetch votes.' });
    }
});

app.get('/admin/votes/tally', async (req, res) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const publishedTracks = db.tracks.filter(t => t.status === 'published' && t.onChainId !== undefined);
        const publishedTrackOnChainIds = new Set(publishedTracks.map(t => t.onChainId!));
        const unprocessedVotes = db.votes.filter(v => v.status === 'unprocessed');
        
        const relevantVotes = unprocessedVotes.filter(v => {
            const track = db.tracks.find(t => t.id === v.trackId);
            return track && track.onChainId !== undefined && publishedTrackOnChainIds.has(track.onChainId);
        });

        if (relevantVotes.length === 0) {
            return res.json({ message: "No unprocessed votes found.", trackIds: [], voteCounts: [] });
        }

        const voteCounts: { [key: number]: number } = {};
        relevantVotes.forEach(vote => {
            const track = db.tracks.find(t => t.id === vote.trackId);
            const trackOnChainId = track!.onChainId!;
            voteCounts[trackOnChainId] = (voteCounts[trackOnChainId] || 0) + 1;
        });
        
        const trackIds = Object.keys(voteCounts).map(Number);
        const counts = Object.values(voteCounts);

        res.json({ trackIds, voteCounts: counts });
    } catch (error) {
        console.error('Error tallying votes:', error);
        res.status(500).json({ error: 'Failed to tally votes.' });
    }
});

app.post('/admin/votes/clear', async (req, res) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        let changed = false;
        db.votes.forEach(vote => {
            if (vote.status === 'unprocessed') {
                vote.status = 'processed';
                changed = true;
            }
        });

        if (changed) {
            await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
            res.status(200).json({ message: 'Unprocessed votes cleared.' });
        } else {
            res.status(200).json({ message: 'No unprocessed votes to clear.' });
        }
    } catch (error) {
        console.error('Error clearing votes:', error);
        res.status(500).json({ error: 'Failed to clear votes.' });
    }
});

// Get all shares for admin
app.get('/admin/shares', async (req, res) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        
        // Transform shares to include track information
        const sharesWithTrackInfo = db.shares.map(share => {
            const track = db.tracks.find(t => t.onChainId === share.trackId);
            return {
                ...share,
                track: track ? {
                    title: track.title,
                    artist: track.artist
                } : {
                    title: 'Unknown Track',
                    artist: 'Unknown Artist'
                }
            };
        });
        
        res.json(sharesWithTrackInfo);
    } catch (error) {
        console.error('Error fetching shares for admin:', error);
        res.status(500).json({ error: 'Failed to fetch shares.' });
    }
});

// Update share status
app.patch('/admin/shares/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['verified', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status provided. Must be verified or rejected.' });
    }

    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const shareIndex = db.shares.findIndex((s: Share) => s.id === id);

        if (shareIndex === -1) {
            return res.status(404).json({ error: 'Share not found.' });
        }
        
        db.shares[shareIndex].status = status;
        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
        
        res.json({ 
            message: `Share status updated to ${status}.`, 
            share: db.shares[shareIndex] 
        });
    } catch (error) {
        console.error('Error updating share status:', error);
        res.status(500).json({ error: 'Failed to update share status.' });
    }
});

// Health check for Pinata configuration
app.get('/health/pinata', async (req, res) => {
    try {
        const PINATA_JWT = process.env.PINATA_JWT;
        if (!PINATA_JWT) {
            return res.status(500).json({ 
                error: 'Pinata JWT not configured',
                configured: false 
            });
        }

        // Test Pinata API access
        const response = await axios.get('https://api.pinata.cloud/data/testAuthentication', {
            headers: {
                'Authorization': `Bearer ${PINATA_JWT}`
            }
        });

        res.json({ 
            message: 'Pinata configuration is working',
            configured: true,
            pinataResponse: response.data
        });
    } catch (error) {
        console.error('Pinata health check failed:', error);
        res.status(500).json({ 
            error: 'Pinata authentication failed',
            configured: !!process.env.PINATA_JWT,
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// --- Server Initialization ---
const startServer = async () => {
    await initializeDatabase();
    app.listen(port, '0.0.0.0', () => {
        console.log(`Backend server is running on http://0.0.0.0:${port}`);
    });
};

startServer();