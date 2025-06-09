import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

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
    artistName: string;
    trackTitle: string;
    genre: string;
    artistWallet: string;
    coverImageUrl: string;
    videoUrl:string;
    status: 'pending' | 'approved' | 'rejected' | 'published';
    submittedAt: string;
    reportCount: number;
    transactionHash?: string;
    onChainTrackId?: string; // To store the ID from the smart contract
}

interface Share {
    id: string;
    walletAddress: string;
    trackId: string; // This is the DB ID of the track
    sharedAt: string;
}

interface Vote {
    id: string;
    onChainTrackId: string;
    voterIdentifier: string; // Using IP address for simple uniqueness
    votedAt: string;
    status: 'tallied' | 'processed';
}

interface Database {
    tracks: Track[];
    shares: Share[];
    votes: Vote[];
}

// Function to ensure directory and file exist
const initializeDatabase = async () => {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.access(dbPath);
    } catch (error) {
        console.log('Database file not found. Creating a new one.');
        await fs.writeFile(dbPath, JSON.stringify({ tracks: [], shares: [], votes: [] }), 'utf-8');
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
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
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
const upload = multer({ storage });

const uploadToPinata = async (file: Express.Multer.File): Promise<string> => {
    const PINATA_JWT = process.env.PINATA_JWT;
    if (!PINATA_JWT) {
        throw new Error('Pinata JWT is not configured on the server.');
    }
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    const formData = new FormData();
    formData.append('file', file.buffer, { 
        filename: file.originalname, 
        contentType: file.mimetype 
    });
    const response = await axios.post(url, formData, {
        headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${PINATA_JWT}`
        }
    });
    const ipfsHash = response.data.IpfsHash;
    if (!ipfsHash) {
        throw new Error('IPFS hash not found in Pinata response.');
    }
    return `${IPFS_GATEWAY_URL}${ipfsHash}`;
};

// --- API Endpoints ---

// Upload a new track
app.post('/upload', upload.fields([
    { name: 'coverImageFile', maxCount: 1 },
    { name: 'videoFile', maxCount: 1 }
]) as any, async (req: Request, res: Response) => {
    try {
        const { artistName, trackTitle, genre, artistWallet } = req.body;
        if (!artistWallet || !artistWallet.startsWith('0x')) {
            return res.status(400).json({ error: 'A valid artist wallet address is required.' });
        }
        if (!req.files || !('coverImageFile' in req.files) || !('videoFile' in req.files)) {
            return res.status(400).json({ error: 'Cover image and video file are required.' });
        }
        const files = req.files as any;
        const coverImageUrl = await uploadToPinata(files['coverImageFile'][0]);
        const videoUrl = await uploadToPinata(files['videoFile'][0]);
        
        const newTrack: Track = {
            id: uuidv4(),
            artistName,
            trackTitle,
            genre,
            artistWallet,
            coverImageUrl,
            videoUrl,
            status: 'pending',
            submittedAt: new Date().toISOString(),
            reportCount: 0
        };
        
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db: Database = JSON.parse(dbData);
        db.tracks.push(newTrack);
        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));

        res.status(200).json({
            message: 'Files uploaded successfully and submitted for review!',
            track: newTrack
        });
    } catch (error) {
        console.error('Error during upload process:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        res.status(500).json({ error: 'Failed to upload files.', details: errorMessage });
    }
});

// Get all submissions
app.get('/submissions', async (req: Request, res: Response) => {
    const { status } = req.query;

    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db: Database = JSON.parse(dbData);
        let tracks = db.tracks || [];

        // Filter by status if the query parameter is provided
        if (status && typeof status === 'string' && ['pending', 'approved', 'rejected', 'published'].includes(status)) {
            tracks = tracks.filter(track => track.status === status);
        }
        
        // Return a consistent object shape
        res.json({ tracks });
    } catch (error) {
        console.error('Error reading submissions from database:', error);
        res.status(500).json({ error: 'Failed to retrieve submissions.' });
    }
});

// Update submission status (approve/reject)
app.patch('/submissions/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status provided.' });
    }

    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db: Database = JSON.parse(dbData);
        const submissionIndex = db.tracks.findIndex(s => s.id === id);

        if (submissionIndex === -1) {
            return res.status(404).json({ error: 'Track not found.' });
        }

        db.tracks[submissionIndex].status = status;
        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
        
        res.status(200).json(db.tracks[submissionIndex]);
    } catch (error) {
        console.error('Error updating submission status:', error);
        res.status(500).json({ error: 'Failed to update submission status.' });
    }
});

// Sync on-chain data after batch publishing
app.post('/submissions/sync-onchain', async (req: Request, res: Response) => {
    const { tracks: syncedTracks } = req.body;

    if (!Array.isArray(syncedTracks) || syncedTracks.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty tracks array provided.' });
    }

    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db: Database = JSON.parse(dbData);

        let updatedCount = 0;

        for (const syncedTrack of syncedTracks) {
            const { videoUrl, onChainTrackId } = syncedTrack;
            if (!videoUrl || !onChainTrackId) continue;

            // Find the track that was approved and matches the videoUrl
            const trackIndex = db.tracks.findIndex(t => t.videoUrl === videoUrl && t.status === 'approved');

            if (trackIndex !== -1) {
                db.tracks[trackIndex].status = 'published';
                db.tracks[trackIndex].onChainTrackId = onChainTrackId.toString(); 
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
            res.status(200).json({ message: `Successfully synced ${updatedCount} tracks.` });
        } else {
            res.status(404).json({ message: 'No matching approved tracks found to sync.' });
        }
    } catch (error) {
        console.error('Error syncing on-chain data:', error);
        res.status(500).json({ error: 'Failed to sync on-chain data.' });
    }
});

// New endpoint to get all approved tracks formatted for manual publishing
app.get('/submissions/approved-for-publishing', async (req: Request, res: Response) => {
    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db: Database = JSON.parse(dbData);
        const approvedTracks = db.tracks.filter(track => track.status === 'approved');

        if (approvedTracks.length === 0) {
            return res.status(404).json({ message: 'No approved tracks ready for publishing.' });
        }

        const formattedTracks = approvedTracks.map(track => {
            return {
                id: track.id,
                artistName: track.artistName,
                trackTitle: track.trackTitle,
                genre: track.genre,
                videoUrl: track.videoUrl,
                coverImageUrl: track.coverImageUrl,
                artistWallet: track.artistWallet,
            };
        });

        res.status(200).json({ tracks: formattedTracks });
    } catch (error) {
        console.error('Error fetching approved tracks:', error);
        res.status(500).json({ error: 'Failed to retrieve approved tracks for publishing.' });
    }
});

// Delete a submission
app.delete('/submissions/:id', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db: Database = JSON.parse(dbData);
        const newSubmissions = db.tracks.filter(s => s.id !== id);

        if (newSubmissions.length === db.tracks.length) {
            return res.status(404).json({ error: 'Track not found.' });
        }

        db.tracks = newSubmissions;
        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
        
        res.status(200).json({ message: 'Track deleted successfully.' });
    } catch (error) {
        console.error('Error deleting submission:', error);
        res.status(500).json({ error: 'Failed to delete submission.' });
    }
});

// --- Share Endpoints ---

// Endpoint to get all shares grouped by track
app.get('/shares-by-track', async (req: Request, res: Response) => {
    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db: Database = JSON.parse(dbData);
        
        const sharesByOnChainTrackId: { [onChainTrackId: string]: Share[] } = {};
        
        // Create a map from DB track ID to on-chain track ID for quick lookup
        const trackIdMap = new Map<string, string>();
        db.tracks.forEach(track => {
            if (track.id && track.onChainTrackId) {
                trackIdMap.set(track.id, track.onChainTrackId);
            }
        });

        for (const share of db.shares) {
            // Find the on-chain ID for the track that was shared
            const onChainTrackId = trackIdMap.get(share.trackId);
            if (onChainTrackId) {
                if (!sharesByOnChainTrackId[onChainTrackId]) {
                    sharesByOnChainTrackId[onChainTrackId] = [];
                }
                sharesByOnChainTrackId[onChainTrackId].push(share);
            }
        }

        res.json(sharesByOnChainTrackId);
    } catch (error) {
        console.error('Error reading shares from database:', error);
        res.status(500).json({ error: 'Failed to retrieve shares.' });
    }
});

// Submit a proof of share
app.post('/shares', async (req: Request, res: Response) => {
    const { walletAddress, trackId } = req.body;
    if (!walletAddress || !trackId) {
        return res.status(400).json({ error: 'walletAddress and trackId are required.' });
    }
    
    const newShare: Share = {
        id: uuidv4(),
        walletAddress,
        trackId,
        sharedAt: new Date().toISOString()
    };

    const dbData = await fs.readFile(dbPath, 'utf-8');
    const db: Database = JSON.parse(dbData);
    
    db.shares.push(newShare);
    
    await fs.writeFile(dbPath, JSON.stringify(db, null, 2));

    res.status(201).json({ message: 'Share recorded successfully!', share: newShare });
});

// --- Vote Endpoints ---

// Record a new vote (gasless)
app.post('/votes', async (req: Request, res: Response) => {
    const { onChainTrackId } = req.body;
    const voterIdentifier = req.ip; // Use IP address to identify voter

    if (!onChainTrackId) {
        return res.status(400).json({ error: 'Track ID is required.' });
    }
    
    if (!voterIdentifier) {
        return res.status(400).json({ error: 'Could not identify voter. Please try again.' });
    }

    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db: Database = JSON.parse(dbData);

        // Check if track exists and is published
        const trackExists = db.tracks.some(t => t.onChainTrackId === onChainTrackId && t.status === 'published');
        if (!trackExists) {
            return res.status(404).json({ error: 'This track is not available for voting.' });
        }
        
        // Anti-abuse: Check if this IP has voted for this track in the last 24 hours
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentVote = db.votes.find(v => 
            v.onChainTrackId === onChainTrackId && 
            v.voterIdentifier === voterIdentifier &&
            new Date(v.votedAt).getTime() > twentyFourHoursAgo
        );

        if (recentVote) {
            return res.status(429).json({ error: 'You have already voted for this track recently.' });
        }

        const newVote: Vote = {
            id: uuidv4(),
            onChainTrackId,
            voterIdentifier,
            votedAt: new Date().toISOString(),
            status: 'tallied'
        };

        db.votes.push(newVote);
        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));

        res.status(201).json({ message: 'Your vote has been recorded successfully!' });

    } catch (error) {
        console.error('Error recording vote:', error);
        res.status(500).json({ error: 'Failed to record vote.' });
    }
});

// Get the tally of unprocessed votes for the admin page
app.get('/votes/tally', async (req: Request, res: Response) => {
    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db: Database = JSON.parse(dbData);

        const unprocessedVotes = db.votes.filter(v => v.status === 'tallied');

        const tally = unprocessedVotes.reduce((acc, vote) => {
            acc[vote.onChainTrackId] = (acc[vote.onChainTrackId] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const trackIds = Object.keys(tally);
        const voteCounts = Object.values(tally);

        res.status(200).json({ tally, trackIds, voteCounts });
    } catch (error) {
        console.error('Error getting vote tally:', error);
        res.status(500).json({ error: 'Failed to get vote tally.' });
    }
});

// Mark all tallied votes as processed after admin submits them on-chain
app.post('/votes/clear', async (req: Request, res: Response) => {
    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db: Database = JSON.parse(dbData);
        
        let processedCount = 0;
        db.votes.forEach(vote => {
            if (vote.status === 'tallied') {
                vote.status = 'processed';
                processedCount++;
            }
        });

        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));

        res.status(200).json({ message: `Successfully cleared ${processedCount} processed votes.` });

    } catch (error) {
        console.error('Error clearing votes:', error);
        res.status(500).json({ error: 'Failed to clear votes.' });
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