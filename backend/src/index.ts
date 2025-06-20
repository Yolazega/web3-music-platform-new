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
app.use(cors()); // Allow all origins
const port = parseInt(process.env.PORT || '3001', 10);
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
        res.json(publishedTracks);
    } catch (error) {
        console.error('Error fetching published tracks:', error);
        res.status(500).json({ error: 'Failed to fetch tracks.' });
    }
});


// New endpoint to get the overall winner
app.get('/tracks/overall-winner', async (req: Request, res: Response) => {
    try {
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));

        // Find the track with the most votes among all published tracks
        const overallWinner = db.tracks
            .filter((t: Track) => t.status === 'published')
            .reduce((max: Track | null, track: Track) => {
                return (max === null || track.votes > max.votes) ? track : max;
            }, null);

        if (overallWinner) {
            res.json(overallWinner);
        } else {
            res.status(404).json({ message: 'No overall winner found.' });
        }
    } catch (error) {
        console.error('Error fetching overall winner:', error);
        res.status(500).json({ error: 'Failed to fetch overall winner.' });
    }
});


// New endpoint to get top tracks by genre
app.get('/tracks/top-by-genre', async (req, res) => {
    try {
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const publishedTracks = db.tracks.filter((t: Track) => t.status === 'published');

        const topTracksByGenre: { [key: string]: Track } = {};

        publishedTracks.forEach((track: Track) => {
            if (!topTracksByGenre[track.genre] || track.votes > topTracksByGenre[track.genre].votes) {
                topTracksByGenre[track.genre] = track;
            }
        });

        res.json(Object.values(topTracksByGenre));
    } catch (error) {
        console.error('Error fetching top tracks by genre:', error);
        res.status(500).json({ error: 'Failed to fetch top tracks by genre.' });
    }
});

app.get('/tracks/:id', async (req: Request, res: Response) => {
    try {
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const track = db.tracks.find((t: Track) => t.id === req.params.id);
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

// Endpoint to handle votes
app.post('/vote', async (req: Request, res: Response) => {
    const { trackId, voterAddress } = req.body;
    const currentWeek = getCurrentWeekNumber();

    if (!trackId || !voterAddress) {
        return res.status(400).json({ error: 'trackId and voterAddress are required.' });
    }

    try {
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const track = db.tracks.find((t: Track) => t.id === trackId);
        
        if (!track) {
            return res.status(404).json({ error: 'Track not found.' });
        }

        // Prevent voting on tracks not from the current week
        if (track.weekNumber !== currentWeek) {
            return res.status(400).json({ error: 'You can only vote for tracks submitted this week.' });
        }

        // Check if the user has already voted for this track this week
        const existingVote = db.votes.find((v: Vote) => 
            v.voterAddress === voterAddress && 
            v.trackId === trackId &&
            v.weekNumber === currentWeek
        );

        if (existingVote) {
            return res.status(400).json({ error: 'You have already voted for this track this week.' });
        }

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


// Endpoint for proof of share submissions
app.post('/share', async (req, res) => {
    const { trackId, userWallet, shareUrl1, shareUrl2 } = req.body;

    if (!trackId || !userWallet || !shareUrl1 || !shareUrl2) {
        return res.status(400).json({ error: 'trackId, userWallet, and two share URLs are required.' });
    }

    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const newShare: Share = {
            id: uuidv4(),
            trackId: parseInt(trackId, 10),
            userWallet,
            shareUrl1,
            shareUrl2,
            status: 'pending',
            submittedAt: new Date().toISOString(),
        };

        db.shares.push(newShare);
        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));

        res.status(201).json({ message: 'Share proof submitted successfully.', share: newShare });
    } catch (error) {
        console.error('Error submitting share proof:', error);
        res.status(500).json({ error: 'Failed to submit share proof.' });
    }
});


// --- Admin Panel Endpoints ---

// Get all submissions for review
app.get('/admin/submissions', async (req: Request, res: Response) => {
    try {
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        // We can optionally filter by status if needed, e.g., only 'pending'
        res.json(db.tracks);
    } catch (error) {
        console.error('Error fetching submissions for admin:', error);
        res.status(500).json({ error: 'Failed to fetch submissions.' });
    }
});

// Update the status of a submission
app.patch('/admin/submissions/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, onChainId } = req.body;

    if (!status || !['approved', 'rejected', 'published'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status provided.' });
    }
    
    // onChainId is required when status is 'published'
    if (status === 'published' && typeof onChainId !== 'number') {
        return res.status(400).json({ error: 'onChainId is required for published tracks.' });
    }

    try {
        const db = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const trackIndex = db.tracks.findIndex((t: Track) => t.id === id);

        if (trackIndex === -1) {
            return res.status(404).json({ error: 'Track not found.' });
        }
        
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

// Admin endpoint to get all share submissions
app.get('/admin/share-submissions', async (req, res) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        res.json(db.shares);
    } catch (error) {
        console.error('Error fetching share submissions:', error);
        res.status(500).json({ error: 'Failed to fetch share submissions.' });
    }
});

// Admin endpoint to update the status of a share submission
app.patch('/admin/share-submissions/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['verified', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status provided. Must be "verified" or "rejected".' });
    }

    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        const shareIndex = db.shares.findIndex(s => s.id === id);

        if (shareIndex === -1) {
            return res.status(404).json({ error: 'Share submission not found.' });
        }

        db.shares[shareIndex].status = status;
        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));

        res.json({ message: `Share status updated to ${status}.`, share: db.shares[shareIndex] });
    } catch (error) {
        console.error('Error updating share status:', error);
        res.status(500).json({ error: 'Failed to update share status.' });
    }
});

app.get('/admin/votes/tally', async (req, res) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));

        const publishedTrackOnChainIds = new Set(
            db.tracks
                .filter(t => t.status === 'published' && t.onChainId !== undefined)
                .map(t => t.onChainId!)
        );

        const unprocessedVotes = db.votes.filter(v => 
            v.status === 'unprocessed' && 
            publishedTrackOnChainIds.has(parseInt(v.trackId)) // Ensure vote is for a published track
        );

        if (unprocessedVotes.length === 0) {
            return res.status(404).json({ message: "No unprocessed votes for published tracks found." });
        }

        const voteCounts: { [key: number]: number } = {};
        unprocessedVotes.forEach(vote => {
            const trackOnChainId = parseInt(vote.trackId, 10);
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

app.post('/votes/clear', async (req, res) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        
        // Mark all 'unprocessed' votes as 'processed'
        db.votes.forEach(vote => {
            if (vote.status === 'unprocessed') {
                vote.status = 'processed';
            }
        });

        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
        res.status(200).json({ message: 'Unprocessed votes have been cleared (marked as processed).' });
    } catch (error) {
        console.error('Error clearing votes:', error);
        res.status(500).json({ error: 'Failed to clear votes.' });
    }
});

// Admin endpoint for share submissions
app.get('/admin/shares', async (req, res) => {
    try {
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        res.json(db.shares);
    } catch (error) {
        console.error('Error fetching share submissions:', error);
        res.status(500).json({ error: 'Failed to fetch share submissions.' });
    }
});

app.get('/config', (req, res) => {
    try {
        const configPath = path.join(__dirname, '..', '..', 'src', 'config.ts');
        exec(`cat ${configPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return res.status(500).send('Error reading config file');
            }
            res.type('text/plain').send(stdout);
        });
    } catch (e) {
        console.error('Failed to read config file:', e);
        res.status(500).send('Failed to read config');
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