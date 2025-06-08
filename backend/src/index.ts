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
    coverImageUrl: string;
    videoUrl:string;
    status: 'pending' | 'approved' | 'rejected' | 'published';
    submittedAt: string;
    reportCount: number;
    transactionHash?: string;
}

interface Database {
    tracks: Track[];
}

// Function to ensure directory and file exist
const initializeDatabase = async () => {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.access(dbPath);
    } catch (error) {
        console.log('Database file not found. Creating a new one.');
        await fs.writeFile(dbPath, JSON.stringify({ tracks: [] }), 'utf-8');
    }
};

// --- Middlewares ---
app.use(cors()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

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
    formData.append('file', file.buffer, file.originalname);
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
        const { artistName, trackTitle, genre } = req.body;
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

// Confirm publication and store transaction hash
app.post('/submissions/:id/confirm-publication', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { transactionHash } = req.body;

    if (!transactionHash) {
        return res.status(400).json({ error: 'Transaction hash is required.' });
    }

    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db: Database = JSON.parse(dbData);
        const submissionIndex = db.tracks.findIndex(s => s.id === id);

        if (submissionIndex === -1) {
            return res.status(404).json({ error: 'Track not found.' });
        }

        db.tracks[submissionIndex].status = 'published';
        db.tracks[submissionIndex].transactionHash = transactionHash;
        
        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
        
        res.status(200).json(db.tracks[submissionIndex]);
    } catch (error) {
        console.error('Error confirming publication:', error);
        res.status(500).json({ error: 'Failed to confirm publication.' });
    }
});

// Delete a submission
app.delete('/submissions/:id', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db: Database = JSON.parse(dbData);
        const initialLength = db.tracks.length;
        db.tracks = db.tracks.filter(s => s.id !== id);
        
        if (db.tracks.length === initialLength) {
            return res.status(404).json({ error: 'Track not found.' });
        }

        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
        res.status(200).json({ message: 'Submission deleted successfully.' });
    } catch (error) {
        console.error('Error deleting submission:', error);
        res.status(500).json({ error: 'Failed to delete submission.' });
    }
});


// Report a submission
app.post('/submissions/:id/report', async (req: Request, res: Response) => {
    const { id } = req.params;
    
    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db: Database = JSON.parse(dbData);
        const submissionIndex = db.tracks.findIndex(s => s.id === id);

        if (submissionIndex === -1) {
            return res.status(404).json({ error: 'Track not found.' });
        }

        db.tracks[submissionIndex].reportCount += 1;
        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
        
        res.status(200).json(db.tracks[submissionIndex]);
    } catch (error) {
        console.error('Error reporting submission:', error);
        res.status(500).json({ error: 'Failed to report submission.' });
    }
});


// Get platform statistics
app.get('/stats', async (req: Request, res: Response) => {
    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db: Database = JSON.parse(dbData);
        const tracks = db.tracks || [];

        const totalSubmissions = tracks.length;
        const pendingCount = tracks.filter((t: Track) => t.status === 'pending').length;
        const approvedCount = tracks.filter((t: Track) => t.status === 'approved').length;
        const rejectedCount = tracks.filter((t: Track) => t.status === 'rejected').length;
        const publishedCount = tracks.filter((t: Track) => t.status === 'published').length;

        res.json({
            totalSubmissions,
            pending: pendingCount,
            approved: approvedCount,
            rejected: rejectedCount,
            published: publishedCount
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get stats.' });
    }
});


// --- Server Initialization ---
const startServer = async () => {
    await initializeDatabase();
    app.listen(port, () => {
        console.log(`Backend server is running on http://localhost:${port}`);
    });
};

startServer().catch(console.error); 