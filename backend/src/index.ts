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
import { registerTracksOnChain } from './blockchain';

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

interface Share {
    id: string;
    trackId: string;
    userId: string;
    platform: string;
    proofUrl: string;
    status: 'pending' | 'verified' | 'rejected';
    weekNumber: number;
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
            shares: [],
            votes: [],
            users: []
        }, null, 2));
    }
};

// --- Middlewares ---
// Configure CORS to allow requests from your specific frontend URL
const allowedOrigins = [
    'http://localhost:5173', // For local development
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
        /*
        if (isSubmissionPeriodOver()) {
            return res.status(400).json({ error: 'The submission period for this week is over. Please try again next week.' });
        }
        */

        const { artist, title, artistWallet, genre } = req.body;
        if (!artistWallet || !artistWallet.startsWith('0x')) {
            return res.status(400).json({ error: 'A valid artist wallet address is required.' });
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
            artistWallet,
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
app.post('/share', async (req: Request, res: Response) => {
    try {
        const { trackId, userId, platform, proofUrl } = req.body;
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const track = db.tracks.find((t: Track) => t.id === trackId);

        if (!track) {
            return res.status(404).json({ error: 'Track not found.' });
        }

        const newShare: Share = {
            id: uuidv4(),
            trackId,
            userId,
            platform,
            proofUrl,
            status: 'pending',
            weekNumber: track.weekNumber,
        };

        db.shares.push(newShare);
        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));

        res.status(201).json({ message: 'Share submitted for verification.', share: newShare });
    } catch (error) {
        console.error('Error submitting share:', error);
        res.status(500).json({ error: 'Failed to submit share.' });
    }
});

// Endpoint for voting on a track
app.post('/vote', async (req: Request, res: Response) => {
    try {
        const { trackId, voterAddress } = req.body;
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));

        const track: Track | undefined = db.tracks.find((t: Track) => t.id === trackId);
        if (!track || track.status !== 'published') {
            return res.status(400).json({ error: 'You can only vote on published tracks.' });
        }

        /*
        if (isVotingPeriodOverForWeek(track.weekNumber)) {
             return res.status(400).json({ error: 'The voting period for this track is over.' });
        }
        */

        // Basic check to prevent double voting from the same address for the same track
        const existingVote = db.votes.find((v: Vote) => v.trackId === trackId && v.voterAddress === voterAddress);
        if (existingVote) {
            return res.status(400).json({ error: 'You have already voted for this track.' });
        }
        
        const newVote: Vote = {
            id: uuidv4(),
            trackId,
            voterAddress,
            timestamp: Date.now(),
            status: 'unprocessed',
            weekNumber: track.weekNumber,
        };
        
        db.votes.push(newVote);
        track.votes += 1; // Also increment the vote count on the track itself
        
        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));

        res.status(201).json({ message: 'Vote recorded successfully.', vote: newVote });
    } catch (error) {
        console.error('Error recording vote:', error);
        res.status(500).json({ error: 'Failed to record vote.' });
    }
});

// Get a tally of all unprocessed votes, grouped by track
app.get('/votes/tally', async (req: Request, res: Response) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const unprocessedVotes = db.votes.filter(v => v.status === 'unprocessed');

        if (unprocessedVotes.length === 0) {
            return res.status(200).json({ trackIds: [], voteCounts: [] });
        }

        const tally: { [onChainId: number]: number } = {};
        for (const vote of unprocessedVotes) {
            // Find the track corresponding to the vote
            const track = db.tracks.find(t => t.id === vote.trackId);
            // Ensure the track has an onChainId and is published before tallying
            if (track && track.onChainId && track.status === 'published') {
                tally[track.onChainId] = (tally[track.onChainId] || 0) + 1;
            }
        }

        const trackIds = Object.keys(tally).map(id => parseInt(id, 10));
        const voteCounts = Object.values(tally);

        res.status(200).json({ trackIds, voteCounts });

    } catch (error) {
        console.error('Error tallying votes:', error);
        res.status(500).json({ error: 'Failed to tally votes.' });
    }
});

// Marks all unprocessed votes as processed after successful on-chain transaction
app.post('/votes/clear', async (req: Request, res: Response) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));

        let updatedCount = 0;
        db.votes.forEach(vote => {
            if (vote.status === 'unprocessed') {
                vote.status = 'processed';
                updatedCount++;
            }
        });

        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));

        res.status(200).json({ message: `Successfully cleared and marked ${updatedCount} votes as processed.` });

    } catch (error) {
        console.error('Error clearing votes:', error);
        res.status(500).json({ error: 'Failed to clear votes.' });
    }
});

// --- ADMIN ENDPOINTS ---

// Get all submissions (pending, approved, rejected) for admin view
app.get('/admin/submissions', async (req: Request, res: Response) => {
    try {
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        res.status(200).json(db.tracks);
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ error: 'Failed to fetch submissions.' });
    }
});

// Approve a submission
app.post('/admin/approve/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const track = db.tracks.find((t: Track) => t.id === id);
        if (track) {
            track.status = 'approved';
            await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
            res.status(200).json({ message: 'Track approved.', track });
        } else {
            res.status(404).json({ error: 'Track not found.' });
        }
    } catch (error) {
        console.error('Error approving track:', error);
        res.status(500).json({ error: 'Failed to approve track.' });
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

// For testing: Publish all approved tracks immediately
app.post('/admin/publish-all-approved', async (req: Request, res: Response) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        
        const tracksToPublish = db.tracks.filter((t: Track) => t.status === 'approved');

        if (tracksToPublish.length === 0) {
            return res.status(200).json({ message: 'No approved tracks to publish.' });
        }
        
        // 1. Prepare data for the smart contract
        const trackData = {
            artistWallets: tracksToPublish.map(t => t.artistWallet),
            artistNames: tracksToPublish.map(t => t.artist),
            trackTitles: tracksToPublish.map(t => t.title),
            genres: tracksToPublish.map(t => t.genre),
            videoUrls: tracksToPublish.map(t => t.videoUrl!),
            coverImageUrls: tracksToPublish.map(t => t.coverImageUrl!),
        };

        // 2. Call the blockchain function
        const { onChainIds } = await registerTracksOnChain(trackData);

        // 3. Update database with on-chain ID and new status
        onChainIds.forEach(chainInfo => {
            // We use videoUrl as the unique key to map back from the event log
            const track = db.tracks.find(t => t.videoUrl === chainInfo.videoUrl);
            if (track) {
                track.onChainId = parseInt(chainInfo.onChainId, 10);
                track.status = 'published';
            }
        });

        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));

        res.status(200).json({ 
            message: `Successfully published ${tracksToPublish.length} tracks on-chain.`,
            publishedTracks: onChainIds
        });

    } catch (error: any) {
        console.error('Error publishing all approved tracks:', error);
        res.status(500).json({ error: 'Failed to publish approved tracks.', details: error.message });
    }
});

// Get all shares for admin verification
app.get('/admin/shares', async (req: Request, res: Response) => {
    try {
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        res.status(200).json(db.shares);
    } catch (error) {
        console.error('Error fetching shares:', error);
        res.status(500).json({ error: 'Failed to fetch shares.' });
    }
});

// Get all votes for admin view
app.get('/admin/votes', async (req: Request, res: Response) => {
    try {
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        res.status(200).json(db.votes || []);
    } catch (error) {
        console.error('Error fetching votes:', error);
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

// --- Server Initialization ---
const startServer = async () => {
    await initializeDatabase();
    app.listen(port, () => {
        console.log(`Backend server is running on http://localhost:${port}`);
    });
};

startServer();