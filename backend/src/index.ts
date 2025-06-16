import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { startOfWeek, differenceInWeeks } from 'date-fns';
import { getCurrentWeekNumber, isSubmissionPeriodOver, isVotingPeriodOverForWeek } from './time';
import { uploadToPinata } from './pinata';
import { ethers } from 'ethers';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const IPFS_GATEWAY_URL = process.env.IPFS_GATEWAY_URL || "https://gateway.pinata.cloud/ipfs/";

// --- Database Path Setup ---
const dataDir = process.env.RENDER_DISK_MOUNT_PATH || path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'db.json');

// Define a type for our track object for better code quality
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

// This is the definitive structure for a "Proof of Share" submission.
interface Share {
    id: string;
    trackId: number;       // The on-chain ID of the track shared.
    userWallet: string;    // The wallet of the user who shared.
    shareUrl1: string;     // The first proof URL (e.g., Twitter post).
    shareUrl2: string;     // The second proof URL (e.g., Facebook post).
    status: 'pending' | 'verified' | 'rejected'; // The verification status.
    submittedAt: string;   // The ISO timestamp of the submission.
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
    shares: Share[]; // <-- Now uses the correct, single Share interface
    votes: Vote[];
}

interface CustomRequest extends Request {
    files?: { [fieldname: string]: Express.Multer.File[] };
}

// Function to ensure directory and file exist
const initializeDatabase = async () => {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.access(dbPath);
    } catch (error) {
        console.log('Database file not found. Creating a new one.');
        await fs.writeFile(dbPath, JSON.stringify({
            tracks: [],
            shares: [], // Initialize with an empty shares array
            votes: [],
        }, null, 2));
    }
};

// --- Middlewares ---
// Configure CORS to allow requests from your specific frontend URL
const allowedOrigins = [
    'http://localhost:5173', // For local development
    'https://web3-music-frontend.onrender.com', // Our new Render frontend
    'https://web3-music-platform-new.vercel.app' // For deployed frontend
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow the main domain and any vercel subdomains
    const isAllowed = allowedOrigins.some(allowedOrigin => origin.startsWith(allowedOrigin)) || 
                      origin.endsWith('.vercel.app');

    if (isAllowed) {
      callback(null, true);
    } else {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      callback(new Error(msg));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', true); // Needed to get user's IP address behind a proxy like Render

// --- Test Route ---
app.get('/', (req: Request, res: Response) => {
  res.send('Hello from the Web3 Music Platform backend!');
});

// --- File Upload Setup ---
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100 MB limit
});

// --- API Endpoints ---

// Upload a new track
app.post('/upload', upload.fields([
    { name: 'coverImageFile', maxCount: 1 },
    { name: 'videoFile', maxCount: 1 },
]), async (req: any, res: Response) => {
    try {
        // Only enforce submission deadlines in production
        if (process.env.NODE_ENV === 'production' && isSubmissionPeriodOver()) {
            return res.status(400).json({ error: 'The submission period for this week is over. Please try again next week.' });
        }

        const { artist, title, artistWallet, genre } = req.body;
        
        let checksummedWallet: string;
        try {
            // Validate and get the checksummed address
            checksummedWallet = ethers.getAddress(artistWallet);
        } catch (e) {
            return res.status(400).json({ error: 'A valid, checksummed artist wallet address is required.' });
        }
        
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (!files || !files['videoFile'] || !files['coverImageFile']) {
            return res.status(400).json({ error: 'Cover image and video file are required.' });
        }
        
        const videoFile = files['videoFile'][0];
        const coverImageFile = files['coverImageFile'][0];

        // Upload files to Pinata and get their IPFS URLs
        const videoUrl = await uploadToPinata(videoFile);
        const coverImageUrl = await uploadToPinata(coverImageFile);

        const newTrack: Track = {
            id: uuidv4(),
            title: title,
            artist: artist,
            artistWallet: checksummedWallet,
            filePath: '', // This field is no longer needed
            ipfsHash: videoUrl.split('/').pop() || '', // Extract hash from URL
            genre: genre,
            status: 'pending',
            votes: 0,
            weekNumber: getCurrentWeekNumber(),
            submittedAt: new Date().toISOString(),
            coverImageUrl: coverImageUrl,
            videoUrl: videoUrl,
        };

        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        db.tracks.push(newTrack);
        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));

        res.status(201).json({ message: 'Track uploaded successfully. It is pending approval.', track: newTrack });
    } catch (error) {
        console.error('Error uploading track:', error);
        res.status(500).json({ error: 'Failed to upload track.' });
    }
});

// Get all tracks (for public view)
app.get('/tracks', async (req: Request, res: Response) => {
    try {
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        // Only return published tracks to the public
        const publishedTracks = db.tracks.filter((t: Track) => t.status === 'published');
        res.status(200).json(publishedTracks);
    } catch (error) {
        console.error('Error fetching tracks:', error);
        res.status(500).json({ error: 'Failed to fetch tracks.' });
    }
});

// --- New Endpoints for Landing Page ---

// Get the top-voted published track for each genre
app.get('/tracks/top-by-genre', async (req: Request, res: Response) => {
    try {
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const publishedTracks = db.tracks.filter((t: Track) => t.status === 'published');
        
        const topTracksByGenre: { [genre: string]: Track } = {};

        publishedTracks.forEach((track: Track) => {
            if (!topTracksByGenre[track.genre] || track.votes > topTracksByGenre[track.genre].votes) {
                topTracksByGenre[track.genre] = track;
            }
        });

        res.status(200).json(topTracksByGenre);
    } catch (error) {
        console.error('Error fetching top tracks by genre:', error);
        res.status(500).json({ error: 'Failed to fetch top tracks by genre.' });
    }
});

// Get the single overall top-voted track
app.get('/tracks/overall-winner', async (req: Request, res: Response) => {
    try {
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const publishedTracks = db.tracks.filter((t: Track) => t.status === 'published');

        if (publishedTracks.length === 0) {
            return res.status(200).json(null); // No winner yet
        }

        const overallWinner = publishedTracks.reduce((winner: Track, currentTrack: Track) => {
            return currentTrack.votes > winner.votes ? currentTrack : winner;
        });

        res.status(200).json(overallWinner);
    } catch (error) {
        console.error('Error fetching overall winner:', error);
        res.status(500).json({ error: 'Failed to fetch overall winner.' });
    }
});


// Get top 50 tracks for a specific genre
app.get('/genre/:genreName', async (req: Request, res: Response) => {
    try {
        const { genreName } = req.params;
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));

        const genreTracks = db.tracks
            .filter((t: Track) => t.status === 'published' && t.genre.toLowerCase() === genreName.toLowerCase())
            .sort((a: Track, b: Track) => b.votes - a.votes)
            .slice(0, 50);
        
        res.status(200).json(genreTracks);
    } catch (error) {
        console.error(`Error fetching tracks for genre ${req.params.genreName}:`, error);
        res.status(500).json({ error: 'Failed to fetch genre tracks.' });
    }
});

// Endpoint for sharing a track
app.post('/shares/record', async (req: Request, res: Response) => {
    try {
        const { userWallet, trackId, shareUrl1, shareUrl2 } = req.body;

        // Make sure we have all the required data
        if (!userWallet || trackId === undefined || !shareUrl1 || !shareUrl2) {
            return res.status(400).json({ error: 'Missing required fields for recording share.' });
        }

        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));

        // Check if the track exists and is published
        const trackExists = db.tracks.some((t: Track) => t.onChainId === trackId && t.status === 'published');
        if (!trackExists) {
            return res.status(404).json({ error: 'The specified track does not exist or is not the current winner.' });
        }

        const newShare: Share = {
            id: uuidv4(),
            userWallet: ethers.getAddress(userWallet), // Sanitize wallet address
            trackId,
            shareUrl1,
            shareUrl2,
            status: 'pending',
            submittedAt: new Date().toISOString()
        };

        db.shares.push(newShare);

        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));

        res.status(201).json({ message: 'Share recorded successfully, pending verification.' });
    } catch (error) {
        console.error('Error recording share:', error);
        res.status(500).json({ error: 'Failed to record share.' });
    }
});

// --- ADMIN ENDPOINTS ---

// Get all submissions (pending, approved, rejected) for admin view
app.get('/admin/submissions', async (req: Request, res: Response) => {
    try {
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        res.status(200).json(db.tracks.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
    } catch (error) {
        console.error('Error fetching submissions for admin:', error);
        res.status(500).json({ error: 'Failed to fetch submissions.' });
    }
});

// Approve a submission
app.post('/admin/approve/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const track = db.tracks.find((t: Track) => t.id === id);
        if (track && track.status === 'pending') {
            track.status = 'approved';
            await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
            res.status(200).json({ message: 'Track approved successfully' });
        } else {
            res.status(404).json({ error: 'Track not found or not in pending state' });
        }
    } catch (error) {
        console.error('Error approving track:', error);
        res.status(500).json({ error: 'Failed to approve track' });
    }
});

// Publish all approved submissions for the previous week
app.post('/admin/publish-weekly-uploads', async (req: Request, res: Response) => {
    try {
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const currentWeek = getCurrentWeekNumber();
        const lastWeek = currentWeek - 1;

        if (lastWeek <= 0) {
            return res.status(400).json({ error: 'Not enough weeks have passed to publish.' });
        }

        const tracksToPublish = db.tracks.filter((t: Track) =>
            t.weekNumber === lastWeek && t.status === 'approved'
        );

        if (tracksToPublish.length === 0) {
            return res.status(200).json({ message: 'No approved tracks from last week to publish.' });
        }

        // In a real scenario, here you would call the smart contract's
        // batchRegisterAndUpload function.
        // For now, we just update the status.

        tracksToPublish.forEach((t: Track) => t.status = 'published');

        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
        res.status(200).json({ message: `Successfully published ${tracksToPublish.length} tracks.` });

    } catch (error) {
        console.error('Error publishing weekly uploads:', error);
        res.status(500).json({ error: 'Failed to publish weekly uploads.' });
    }
});

// For testing: Get data for publishing all approved tracks
app.get('/admin/get-publish-data', async (req: Request, res: Response) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        
        const tracksToPublish = db.tracks.filter((t: Track) => t.status === 'approved' && !t.onChainId);

        if (tracksToPublish.length === 0) {
            return res.status(200).json({ 
                message: 'No new approved tracks to publish.', 
                trackData: null 
            });
        }
        
        const validationErrors = tracksToPublish
            .map(t => (!t.videoUrl || !t.coverImageUrl) ? `Track "${t.title}" is missing a video or cover URL.` : null)
            .filter(Boolean);

        if (validationErrors.length > 0) {
            return res.status(400).json({ error: "Validation failed for some tracks.", details: validationErrors.join(' ') });
        }
        
        const trackData = {
            artistWallets: tracksToPublish.map(t => t.artistWallet),
            artistNames: tracksToPublish.map(t => t.artist),
            trackTitles: tracksToPublish.map(t => t.title),
            genres: tracksToPublish.map(t => t.genre),
            videoUrls: tracksToPublish.map(t => t.videoUrl!),
            coverImageUrls: tracksToPublish.map(t => t.coverImageUrl!),
        };

        res.status(200).json({ trackData });

    } catch (error: any) {
        console.error('Error getting approved tracks data:', error);
        res.status(500).json({ error: 'Failed to get approved tracks data.', details: error.message });
    }
});

app.post('/admin/confirm-publish', async (req: Request, res: Response) => {
    try {
        const { successfulTracks } = req.body; // Expecting an array of { coverImageUrl: string, onChainId: number }
        
        if (!successfulTracks || !Array.isArray(successfulTracks)) {
            return res.status(400).json({ error: 'Invalid payload.' });
        }

        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));

        let updatedCount = 0;
        successfulTracks.forEach((publishedTrack: { coverImageUrl: string, onChainId: number }) => {
            const track = db.tracks.find(t => t.coverImageUrl === publishedTrack.coverImageUrl);
            if (track && !track.onChainId) { // Prevent re-processing
                track.onChainId = publishedTrack.onChainId;
                track.status = 'published';
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
        }

        res.status(200).json({ message: `Successfully confirmed and updated ${updatedCount} tracks.` });

    } catch (error) {
        console.error('Error confirming track publication:', error);
        res.status(500).json({ error: 'Failed to confirm publication.' });
    }
});

// GET: All votes for the admin dashboard.
app.get('/admin/votes', async (req: Request, res: Response) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        // Ensure votes array exists, return empty array if not
        res.status(200).json(db.votes || []);
    } catch (error) {
        console.error('Error fetching votes for admin:', error);
        res.status(500).json({ error: 'Failed to fetch votes.' });
    }
});

// Verify a share
app.post('/admin/verify-share/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const share = db.shares.find((s: Share) => s.id === id);

        if (share) {
            share.status = 'verified';
            await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
            res.status(200).json({ message: 'Share verified.', share });
        } else {
            res.status(404).json({ error: 'Share not found.' });
        }
    } catch (error) {
        console.error('Error verifying share:', error);
        res.status(500).json({ error: 'Failed to verify share.' });
    }
});

// GET: All "Proof of Share" submissions for the admin dashboard.
app.get('/admin/share-submissions', async (req: Request, res: Response) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        
        // We need to return not just the share, but also info about the track being shared.
        const populatedShares = db.shares.map(share => {
            const track = db.tracks.find(t => t.onChainId === share.trackId);
            return {
                ...share,
                track: track ? { title: track.title, artist: track.artist } : { title: 'Unknown Track', artist: 'Unknown Artist' }
            };
        }).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());


        res.status(200).json(populatedShares);
    } catch (error) {
        console.error('Error fetching share submissions for admin:', error);
        res.status(500).json({ error: 'Failed to fetch share submissions.' });
    }
});

// POST: Verify a "Proof of Share" submission.
app.post('/admin/shares/verify/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const share = db.shares.find(s => s.id === id);

        if (share) {
            share.status = 'verified';
            await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
            res.status(200).json({ message: 'Share verified successfully.' });
        } else {
            res.status(404).json({ error: 'Share not found.' });
        }
    } catch (error) {
        console.error('Error verifying share:', error);
        res.status(500).json({ error: 'Failed to verify share.' });
    }
});

// POST: Reject a "Proof of Share" submission.
app.post('/admin/shares/reject/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const share = db.shares.find(s => s.id === id);

        if (share) {
            share.status = 'rejected';
            await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
            res.status(200).json({ message: 'Share rejected successfully.' });
        } else {
            res.status(404).json({ error: 'Share not found.' });
        }
    } catch (error) {
        console.error('Error rejecting share:', error);
        res.status(500).json({ error: 'Failed to reject share.' });
    }
});

// --- Server Initialization ---
const startServer = async () => {
    await initializeDatabase();
    app.listen(port, () => {
        console.log(`Backend server is running on http://localhost:${port}`);
    });
};

startServer();