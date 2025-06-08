import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import fsSync from 'fs';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const IPFS_GATEWAY_URL = process.env.IPFS_GATEWAY_URL || "https://gateway.pinata.cloud/ipfs/";

// --- Database Path Setup ---
// We create a `data` directory and store our db.json there.
// This is compatible with Render's persistent disks feature.
const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'db.json');

// Function to ensure directory and file exist
const initializeDatabase = async () => {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        // Check if the file exists
        await fs.access(dbPath);
    } catch (error) {
        // If the file doesn't exist, create it with an empty array
        await fs.writeFile(dbPath, JSON.stringify([]), 'utf-8');
    }
};

// Define a type for our track object for better code quality
interface Track {
    id: string;
    artistName: string;
    trackTitle: string;
    genre: string;
    coverImageUrl: string;
    videoUrl: string;
    status: 'pending' | 'approved' | 'rejected' | 'published';
    submittedAt: string;
    reportCount: number;
    transactionHash?: string;
}

// Middlewares
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// A simple test route
app.get('/', (req: Request, res: Response) => {
  res.send('Hello from the Web3 Music Platform backend!');
});

// Multer setup for handling file uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper function to upload a file to Pinata
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

// The real upload route
app.post('/upload', (upload.fields([
    { name: 'coverImageFile', maxCount: 1 },
    { name: 'videoFile', maxCount: 1 }
]) as any), async (req: Request, res: Response) => {
    console.log('Received upload request...');

    try {
        const { artistName, trackTitle, genre } = req.body;
        console.log('Artist:', artistName, 'Title:', trackTitle, 'Genre:', genre);

        if (!req.files || !('coverImageFile' in req.files) || !('videoFile' in req.files)) {
            res.status(400).json({ error: 'Cover image and video file are required.' });
            return;
        }

        const files = req.files as any;
        const coverImageFile = files['coverImageFile'][0];
        const videoFile = files['videoFile'][0];

        console.log('Uploading cover image to Pinata...');
        const coverImageUrl = await uploadToPinata(coverImageFile);

        console.log('Uploading video to Pinata...');
        const videoUrl = await uploadToPinata(videoFile);

        console.log('Uploads successful! Saving to database...');
        
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
        
        try {
            const dbData = await fs.readFile(dbPath, 'utf-8');
            const db = JSON.parse(dbData);
            db.tracks.push(newTrack);
            await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
            console.log('Successfully saved track to database.');
        } catch (dbError) {
             console.error('Error writing to database:', dbError);
             res.status(500).json({ error: 'Failed to save track to database.' });
             return;
        }

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

// Endpoint to get all submissions
app.get('/submissions', async (req: Request, res: Response) => {
    try {
        await initializeDatabase(); // Ensure db exists before reading
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const submissions = JSON.parse(dbData);
        res.json(submissions);
    } catch (error) {
        console.error('Error reading submissions from database:', error);
        res.status(500).json({ error: 'Failed to retrieve submissions.' });
    }
});

// Endpoint to update submission status (approve/reject)
app.patch('/submissions/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status provided.' });
    }

    try {
        await initializeDatabase(); // Ensure db exists before reading
        const dbData = await fs.readFile(dbPath, 'utf-8');
        let submissions: Track[] = JSON.parse(dbData);
        const submissionIndex = submissions.findIndex(s => s.id === id);

        if (submissionIndex === -1) {
            res.status(404).json({ error: 'Track not found.' });
            return;
        }

        submissions[submissionIndex].status = status;
        await fs.writeFile(dbPath, JSON.stringify(submissions, null, 2));
        
        console.log(`Updated status for track ${id} to ${status}`);
        res.status(200).json(submissions[submissionIndex]);

    } catch (error) {
        console.error('Error updating submission status:', error);
        res.status(500).json({ error: 'Failed to update submission status.' });
    }
});

// New endpoint to confirm publication and store transaction hash
app.post('/submissions/:id/confirm-publication', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { transactionHash } = req.body;

    if (!transactionHash) {
        return res.status(400).json({ error: 'Transaction hash is required.' });
    }

    try {
        await initializeDatabase(); // Ensure db exists before reading
        const dbData = await fs.readFile(dbPath, 'utf-8');
        let submissions: Track[] = JSON.parse(dbData);
        const submissionIndex = submissions.findIndex(s => s.id === id);

        if (submissionIndex === -1) {
            return res.status(404).json({ error: 'Track not found.' });
        }

        submissions[submissionIndex].status = 'published';
        submissions[submissionIndex].transactionHash = transactionHash;
        
        await fs.writeFile(dbPath, JSON.stringify(submissions, null, 2));
        
        console.log(`Confirmed publication for track ${id} with hash ${transactionHash}`);
        res.status(200).json(submissions[submissionIndex]);

    } catch (error) {
        console.error('Error confirming publication:', error);
        res.status(500).json({ error: 'Failed to confirm publication.' });
    }
});

// Endpoint to delete a submission
app.delete('/submissions/:id', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        await initializeDatabase(); // Ensure db exists before reading
        const dbData = await fs.readFile(dbPath, 'utf-8');
        let submissions: Track[] = JSON.parse(dbData);
        const updatedSubmissions = submissions.filter(s => s.id !== id);
        
        if (updatedSubmissions.length === submissions.length) {
            return res.status(404).json({ error: 'Track not found.' });
        }

        await fs.writeFile(dbPath, JSON.stringify(updatedSubmissions, null, 2));
        console.log(`Deleted submission ${id}`);
        res.status(200).json({ message: 'Submission deleted successfully.' });

    } catch (error) {
        console.error('Error deleting submission:', error);
        res.status(500).json({ error: 'Failed to delete submission.' });
    }
});

// Endpoint for reporting a track
app.post('/submissions/:id/report', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        await initializeDatabase(); // Ensure db exists before reading
        const dbData = await fs.readFile(dbPath, 'utf-8');
        let submissions: Track[] = JSON.parse(dbData);
        const submissionIndex = submissions.findIndex(s => s.id === id);

        if (submissionIndex === -1) {
            res.status(404).json({ error: 'Track not found.' });
            return;
        }
        
        submissions[submissionIndex].reportCount = (submissions[submissionIndex].reportCount || 0) + 1;
        await fs.writeFile(dbPath, JSON.stringify(submissions, null, 2));
        
        console.log(`Report received for track ${id}. New count: ${submissions[submissionIndex].reportCount}`);
        res.status(200).json(submissions[submissionIndex]);

    } catch (error) {
        console.error('Error reporting submission:', error);
        res.status(500).json({ error: 'Failed to report submission.' });
    }
});

// Endpoint to get stats
app.get('/stats', async (req: Request, res: Response) => {
    try {
        await initializeDatabase(); // Ensure db exists before reading
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const submissions: Track[] = JSON.parse(dbData);

        const totalSubmissions = submissions.length;
        const pending = submissions.filter(s => s.status === 'pending').length;
        const approved = submissions.filter(s => s.status === 'approved').length;
        const rejected = submissions.filter(s => s.status === 'rejected').length;

        res.status(200).json({
            totalSubmissions,
            pending,
            approved,
            rejected
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats.' });
    }
});

app.listen(port, () => {
    initializeDatabase(); // Ensure db exists on startup
    console.log(`Backend server is running on http://localhost:${port}`);
}); 