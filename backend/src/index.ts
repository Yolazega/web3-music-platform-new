import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fileUpload, { UploadedFile } from 'express-fileupload';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentWeekNumber, isSubmissionPeriodOver } from './time';
import { uploadToPinata } from './pinata';
import { validateVideoDuration } from './videoUtils';
import { ethers } from 'ethers';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';

dotenv.config();

const app = express();

// Security middleware - MUST be first
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "https:"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// Enhanced logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting for upload routes
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 uploads per windowMs
    message: {
        error: 'Too many upload attempts from this IP, please try again after 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting in development
        return process.env.NODE_ENV !== 'production';
    }
});

// General API rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again after 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting in development
        return process.env.NODE_ENV !== 'production';
    }
});

// Apply general rate limiting to all routes
app.use(apiLimiter);

// CORS configuration
app.use(cors({
    origin: ['http://localhost:3000', 'https://axep-frontend.onrender.com', 'https://www.axepvoting.io'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '500mb' })); // Allows high-quality 2-minute videos up to 4K
app.use(express.urlencoded({ extended: true, limit: '500mb' })); // Allows high-quality 2-minute videos up to 4K

// Enhanced file upload configuration with security measures
const tempDir = process.env.NODE_ENV === 'production' ? 
    (process.env.RENDER_DISK_MOUNT_PATH ? path.join(process.env.RENDER_DISK_MOUNT_PATH, 'tmp') : '/tmp/') : 
    '/tmp/';

console.log(`Using temp directory: ${tempDir}`);

// Ensure temp directory exists (async function to avoid top-level await)
const ensureTempDir = async () => {
    try {
        await fs.mkdir(tempDir, { recursive: true });
        console.log(`Temp directory created/verified: ${tempDir}`);
    } catch (error) {
        console.error(`Failed to create temp directory: ${error}`);
    }
};
ensureTempDir();

app.use(fileUpload({
    limits: { 
        fileSize: 500 * 1024 * 1024, // 500MB limit (allows 4K quality 2-minute videos)
        files: 5, // Maximum 5 files per request
    },
    useTempFiles: true,
    tempFileDir: tempDir,
    createParentPath: true,
    abortOnLimit: false, // Let our custom handler deal with size limits
    responseOnLimit: 'File size limit exceeded - maximum 500MB per file. Videos must be 2 minutes or less.',
    uploadTimeout: 15 * 60 * 1000, // 15 minute timeout for high-quality videos
    // Security: Prevent file path traversal
    safeFileNames: true,
    preserveExtension: true,
    debug: true, // Always enable debug for troubleshooting
}) as any);

// Request timeout middleware for upload routes
app.use('/upload', (req, res, next) => {
    req.setTimeout(SERVER_TIMEOUT, () => {
        console.error('Request timeout on upload route');
        if (!res.headersSent) {
            res.status(408).json({ error: 'Request timeout - file upload took too long' });
        }
    });
    res.setTimeout(SERVER_TIMEOUT, () => {
        console.error('Response timeout on upload route');
    });
    next();
});

// Handle payload too large errors specifically for uploads
app.use('/upload', (err: any, req: any, res: any, next: any) => {
    if (err.type === 'entity.too.large' || err.status === 413) {
        console.error('Payload too large error:', err);
        return res.status(413).json({ 
            error: 'File too large. Maximum sizes: 10MB for images, 500MB for videos. Videos must be 2 minutes or less. Please compress your files and try again.' 
        });
    }
    next(err);
});

app.set('trust proxy', true);

const port = parseInt(process.env.PORT || '3001', 10);

// Configure server timeouts for file uploads
const SERVER_TIMEOUT = 10 * 60 * 1000; // 10 minutes

const dataDir = process.env.RENDER_DISK_MOUNT_PATH || path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'db.json');

// --- Enhanced Security Functions ---

// Enhanced file type validation using magic numbers
const validateFileType = (buffer: Buffer, expectedTypes: string[]): boolean => {
    const signatures: { [key: string]: number[][] } = {
        'image/jpeg': [[0xFF, 0xD8, 0xFF]],
        'image/png': [[0x89, 0x50, 0x4E, 0x47]],
        'image/gif': [[0x47, 0x49, 0x46]],
        // MP4 files have multiple possible signatures
        'video/mp4': [
            [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp box at offset 4
            [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70], // ftyp box at offset 4
            [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], // ftyp box at offset 4
            [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70], // ftyp box at offset 4
            [0x66, 0x74, 0x79, 0x70], // Just look for 'ftyp' anywhere in first 32 bytes
        ],
        // MOV files (QuickTime) also have multiple signatures
        'video/quicktime': [
            [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70], // ftyp box
            [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp box
            [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70], // ftyp box
            [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], // ftyp box
            [0x66, 0x74, 0x79, 0x70], // Just look for 'ftyp' anywhere in first 32 bytes
        ],
    };

    for (const type of expectedTypes) {
        const typeSignatures = signatures[type];
        if (!typeSignatures) continue;

        for (const signature of typeSignatures) {
            // For video files, check in first 32 bytes (more flexible)
            const searchLength = type.startsWith('video/') ? Math.min(32, buffer.length) : signature.length;
            
            if (type.startsWith('video/') && signature.length === 4) {
                // For the 'ftyp' signature, search in first 32 bytes
                for (let offset = 0; offset <= searchLength - signature.length; offset++) {
                    let matches = true;
                    for (let i = 0; i < signature.length; i++) {
                        if (buffer[offset + i] !== signature[i]) {
                            matches = false;
                            break;
                        }
                    }
                    if (matches) return true;
                }
            } else {
                // For other signatures, check at specific offset
                if (buffer.length >= signature.length) {
                    let matches = true;
                    for (let i = 0; i < signature.length; i++) {
                        if (buffer[i] !== signature[i]) {
                            matches = false;
                            break;
                        }
                    }
                    if (matches) return true;
                }
            }
        }
    }
    return false;
};

// Enhanced input sanitization
const sanitizeInput = (input: string, maxLength: number = 100): string => {
    if (!input || typeof input !== 'string') return '';
    return input
        .trim()
        .slice(0, maxLength)
        .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
        .replace(/\s+/g, ' '); // Normalize whitespace
};

// Wallet address validation
const validateWalletAddress = (address: string): boolean => {
    try {
        ethers.getAddress(address);
        return true;
    } catch {
        return false;
    }
};

// File validation function
const validateUploadedFile = async (file: UploadedFile, allowedTypes: string[], maxSize: number): Promise<{ valid: boolean; error?: string }> => {
    // Check file size
    if (file.size > maxSize) {
        return { valid: false, error: `File size exceeds ${Math.round(maxSize / (1024 * 1024))}MB limit` };
    }

    // Check MIME type
    if (!allowedTypes.includes(file.mimetype)) {
        return { valid: false, error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}` };
    }

    // Check file extension
    const ext = path.extname(file.name).toLowerCase();
    const allowedExtensions: { [key: string]: string[] } = {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/gif': ['.gif'],
        'video/mp4': ['.mp4'],
        'video/quicktime': ['.mov'],
    };

    const validExtensions = allowedExtensions[file.mimetype] || [];
    if (!validExtensions.includes(ext)) {
        return { valid: false, error: `Invalid file extension for type ${file.mimetype}` };
    }

    // Read file buffer for magic number validation
    try {
        let buffer: Buffer;
        if (file.tempFilePath) {
            const fileData = await fs.readFile(file.tempFilePath);
            buffer = fileData;
        } else if (file.data) {
            buffer = file.data;
        } else {
            return { valid: false, error: 'Unable to read file data' };
        }

        // Validate file signature with debug info
        console.log(`Validating file signature for ${file.name} (${file.mimetype})`);
        console.log(`File size: ${buffer.length} bytes`);
        console.log(`First 32 bytes:`, Array.from(buffer.slice(0, 32)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        
        if (!validateFileType(buffer, [file.mimetype])) {
            console.error(`File signature validation failed for ${file.name}`);
            return { valid: false, error: 'File content does not match declared type' };
        }
        
        console.log(`File signature validation passed for ${file.name}`);

        return { valid: true };
    } catch (error) {
        console.error('File validation error:', error);
        return { valid: false, error: 'File validation failed' };
    }
};

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
        await fs.mkdir(dataDir, { recursive: true, mode: 0o750 });
        await fs.access(dbPath);
    } catch {
        console.log('Database file not found. Creating a new one.');
        await fs.writeFile(dbPath, JSON.stringify({
            tracks: [],
            shares: [],
            votes: [],
        }, null, 2), { mode: 0o640 });
    }
};

// --- Test Route ---
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Web3 Music Platform API',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
    });
});

// --- Enhanced API Endpoints ---

// Upload a new track with comprehensive security
app.post('/upload', uploadLimiter, async (req, res) => {
    const startTime = Date.now();
    let tempFiles: string[] = [];

    try {
        console.log('=== SECURE UPLOAD REQUEST ===');
        console.log('Request received at:', new Date().toISOString());
        console.log('IP Address:', req.ip);
        console.log('User Agent:', req.get('User-Agent'));

        if (process.env.NODE_ENV === 'production' && isSubmissionPeriodOver()) {
            return res.status(400).json({ error: 'The submission period for this week is over.' });
        }

        // Enhanced input validation
        const artist = sanitizeInput(req.body.artist, 50);
        const title = sanitizeInput(req.body.title, 100);
        const artistWallet = sanitizeInput(req.body.artistWallet, 42);
        const genre = sanitizeInput(req.body.genre, 30);

        console.log('Sanitized inputs:', { artist, title, artistWallet, genre });

        // Validate required fields
        if (!artist || artist.length < 2) {
            return res.status(400).json({ error: 'Artist name must be at least 2 characters long.' });
        }
        if (!title || title.length < 2) {
            return res.status(400).json({ error: 'Track title must be at least 2 characters long.' });
        }
        if (!validateWalletAddress(artistWallet)) {
            return res.status(400).json({ error: 'Invalid wallet address format.' });
        }
        if (!genre || !["Pop", "Soul", "Rock", "Country", "RAP", "Afro / Dancehall", "Electronic", "Instrumental / Other"].includes(genre)) {
            return res.status(400).json({ error: 'Invalid genre selected.' });
        }
        
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
            return res.status(400).json({ error: 'Both cover image and video file are required.' });
        }

        // Track temp files for cleanup
        if (coverImageFile.tempFilePath) tempFiles.push(coverImageFile.tempFilePath);
        if (videoFile.tempFilePath) tempFiles.push(videoFile.tempFilePath);

        // Enhanced file validation
        const imageValidation = await validateUploadedFile(
            coverImageFile, 
            ['image/jpeg', 'image/png', 'image/gif'], 
            10 * 1024 * 1024 // 10MB for images
        );
        
        if (!imageValidation.valid) {
            return res.status(400).json({ error: `Cover image validation failed: ${imageValidation.error}` });
        }

        const videoValidation = await validateUploadedFile(
            videoFile, 
            ['video/mp4', 'video/quicktime'], 
            500 * 1024 * 1024 // 500MB for high-quality 2-minute videos
        );
        
        if (!videoValidation.valid) {
            return res.status(400).json({ error: `Video validation failed: ${videoValidation.error}` });
        }

        // CRITICAL: Validate video duration (2 minutes max)
        console.log('Validating video duration...');
        console.log('Video file object structure:', {
            name: videoFile.name,
            size: videoFile.size,
            mimetype: videoFile.mimetype,
            tempFilePath: videoFile.tempFilePath,
            tempFilePathType: typeof videoFile.tempFilePath,
            hasData: !!videoFile.data,
            dataType: typeof videoFile.data,
            keys: Object.keys(videoFile)
        });
        
        if (!videoFile.tempFilePath) {
            return res.status(400).json({ error: 'Video file processing error: temporary file path not available' });
        }
        
        // Handle different tempFilePath scenarios
        let videoFilePath: string;
        
        if (typeof videoFile.tempFilePath === 'string' && videoFile.tempFilePath.trim() !== '') {
            videoFilePath = videoFile.tempFilePath;
            console.log('Using existing tempFilePath:', videoFilePath);
        } else {
            // Fallback: create our own temp file
            console.log('tempFilePath not available or invalid, creating manual temp file');
            console.log('tempFilePath value:', videoFile.tempFilePath);
            console.log('tempFilePath type:', typeof videoFile.tempFilePath);
            
            if (!videoFile.data) {
                return res.status(400).json({ error: 'Video file processing error: no file data available' });
            }
            
            const tempFileName = `video_${Date.now()}_${Math.random().toString(36).substring(7)}.tmp`;
            videoFilePath = path.join(tempDir, tempFileName);
            
            try {
                await fs.writeFile(videoFilePath, videoFile.data);
                console.log('Created manual temp file:', videoFilePath);
                tempFiles.push(videoFilePath); // Add to cleanup list
            } catch (error) {
                console.error('Failed to create manual temp file:', error);
                return res.status(500).json({ error: 'Video file processing error: failed to create temporary file' });
            }
        }
        
        const durationValidation = await validateVideoDuration(videoFilePath, 120); // 2 minutes = 120 seconds
        
        if (!durationValidation.valid) {
            return res.status(400).json({ 
                error: `Video duration validation failed: ${durationValidation.error}`,
                duration: durationValidation.duration 
            });
        }
        
        console.log(`Video duration validation passed: ${Math.round(durationValidation.duration || 0)}s`);

        console.log('File validation passed');
        console.log('File details:', {
            coverImage: { name: coverImageFile.name, size: coverImageFile.size, type: coverImageFile.mimetype },
            video: { name: videoFile.name, size: videoFile.size, type: videoFile.mimetype }
        });
        
        const checksummedWallet = ethers.getAddress(artistWallet);

        // Upload files separately with detailed logging and timing
        console.log('=== STARTING SECURE FILE UPLOADS ===');
        console.log(`Upload started at: ${new Date().toISOString()}`);
        
        console.log('Uploading video file to Pinata...');
        const videoStartTime = Date.now();
        const videoUrl = await uploadToPinata(videoFile);
        const videoUploadTime = Date.now() - videoStartTime;
        console.log(`Video uploaded successfully in ${videoUploadTime}ms:`, videoUrl);

        console.log('Uploading cover image to Pinata...');
        const imageStartTime = Date.now();
        const coverImageUrl = await uploadToPinata(coverImageFile);
        const imageUploadTime = Date.now() - imageStartTime;
        console.log(`Cover image uploaded successfully in ${imageUploadTime}ms:`, coverImageUrl);
        
        console.log(`=== TOTAL UPLOAD TIME: ${videoUploadTime + imageUploadTime}ms ===`);

        // Verify URLs are different (security check)
        if (videoUrl === coverImageUrl) {
            console.error('CRITICAL: Video and cover image have the same URL!', { videoUrl, coverImageUrl });
            return res.status(500).json({ error: 'File upload error: Duplicate IPFS hashes detected' });
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

        // Clean up temp files
        for (const tempFile of tempFiles) {
            try {
                await fs.unlink(tempFile);
                console.log(`Cleaned up temp file: ${tempFile}`);
            } catch (error) {
                console.warn(`Failed to clean up temp file ${tempFile}:`, error);
            }
        }

        const totalTime = Date.now() - startTime;
        console.log(`Track saved to database successfully in ${totalTime}ms total`);
        
        res.status(201).json({ 
            message: 'Track uploaded successfully.',
            track: {
                id: newTrack.id,
                title: newTrack.title,
                artist: newTrack.artist,
                genre: newTrack.genre,
                status: newTrack.status
            },
            processingTime: totalTime
        });
    } catch (error) {
        console.error('Error uploading track:', error);
        
        // Clean up temp files on error
        for (const tempFile of tempFiles) {
            try {
                await fs.unlink(tempFile);
                console.log(`Cleaned up temp file after error: ${tempFile}`);
            } catch (cleanupError) {
                console.warn(`Failed to clean up temp file ${tempFile}:`, cleanupError);
            }
        }
        
        if (error instanceof Error) {
            if (error.message.includes('invalid address')) {
                return res.status(400).json({ error: 'A valid, checksummed artist wallet address is required.' });
            }
            if (error.message.includes('timeout') || error.message.includes('ECONNABORTED')) {
                return res.status(408).json({ 
                    error: 'Upload timeout - your files may be too large or connection is slow. Please try again with smaller files.' 
                });
            }
            if (error.message.includes('IPFS')) {
                return res.status(503).json({ 
                    error: 'IPFS upload service temporarily unavailable. Please try again in a few minutes.' 
                });
            }
            if (error.message.includes('limit') || error.message.includes('size')) {
                return res.status(413).json({ 
                    error: 'File too large. Maximum sizes: 10MB for images, 500MB for 2-minute videos.' 
                });
            }
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

// Get top track by genre for homepage
app.get('/tracks/top-by-genre', async (req, res) => {
    try {
        console.log('=== TOP BY GENRE REQUEST ===');
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        console.log('Total tracks in DB:', db.tracks.length);
        
        const publishedTracks = db.tracks.filter((t) => t.status === 'published');
        console.log('Published tracks:', publishedTracks.length);
        
        if (publishedTracks.length === 0) {
            console.log('No published tracks found, returning empty object');
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

        console.log('Top tracks by genre:', Object.keys(topByGenre));
        res.json(topByGenre);
    } catch (error) {
        console.error('Error fetching top tracks by genre:', error);
        res.status(500).json({ error: 'Failed to fetch top tracks by genre.' });
    }
});

// Get overall winner (track with most votes)
app.get('/tracks/overall-winner', async (req, res) => {
    try {
        console.log('=== OVERALL WINNER REQUEST ===');
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        console.log('Total tracks in DB:', db.tracks.length);
        
        const publishedTracks = db.tracks.filter((t) => t.status === 'published');
        console.log('Published tracks:', publishedTracks.length);
        
        if (publishedTracks.length === 0) {
            console.log('No published tracks found');
            return res.json({ message: 'No published tracks found yet.' });
        }

        // Find the track with the most votes overall
        const winner = publishedTracks.reduce((prev, current) => 
            (current.votes > prev.votes) ? current : prev
        );

        console.log('Overall winner:', winner.title, 'by', winner.artist, 'with', winner.votes, 'votes');
        res.json(winner);
    } catch (error) {
        console.error('Error fetching overall winner:', error);
        res.status(500).json({ error: 'Failed to fetch overall winner.' });
    }
});

// Get a single track by ID (must come after specific routes)
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

// Debug file upload data (without Pinata upload)
app.post('/debug-files', async (req, res) => {
    try {
        console.log('=== FILE DEBUG ENDPOINT ===');
        console.log('Request body keys:', Object.keys(req.body));
        console.log('Request files:', req.files ? Object.keys(req.files) : 'No files');
        
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ error: 'No files were uploaded.' });
        }

        const results: any = {};
        const fileKeys = Object.keys(req.files);

        for (const key of fileKeys) {
            const file = req.files[key] as UploadedFile;
            
            // Create MD5 hash of file content
            const crypto = require('crypto');
            const hash = crypto.createHash('md5').update(file.data).digest('hex');
            
            results[key] = {
                name: file.name,
                size: file.size,
                mimetype: file.mimetype,
                dataType: typeof file.data,
                isBuffer: Buffer.isBuffer(file.data),
                dataLength: file.data ? file.data.length : 0,
                contentMD5: hash,
                preview: file.data ? file.data.slice(0, 50).toString() : 'No data'
            };
            
            console.log(`File ${key}:`, results[key]);
        }

        res.json({ message: 'File debug completed', files: results });
    } catch (error) {
        console.error('File debug error:', error);
        res.status(500).json({ error: 'File debug failed' });
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

// Clean up broken tracks (admin only)
app.delete('/admin/tracks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db: Database = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
        
        const trackIndex = db.tracks.findIndex(t => t.id === id);
        if (trackIndex === -1) {
            return res.status(404).json({ error: 'Track not found' });
        }
        
        const deletedTrack = db.tracks.splice(trackIndex, 1)[0];
        
        // Also remove any votes for this track
        db.votes = db.votes.filter(v => v.trackId !== id);
        
        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
        
        console.log('Deleted track:', deletedTrack.title, 'by', deletedTrack.artist);
        res.json({ message: 'Track deleted successfully', deletedTrack });
    } catch (error) {
        console.error('Error deleting track:', error);
        res.status(500).json({ error: 'Failed to delete track' });
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

// Debug endpoint to test Pinata upload with controlled data
app.post('/debug/pinata-upload', async (req, res) => {
    try {
        const PINATA_JWT = process.env.PINATA_JWT;
        if (!PINATA_JWT) {
            return res.status(500).json({ error: 'Pinata JWT not configured' });
        }

        // Create test data with timestamp to ensure uniqueness
        const timestamp = Date.now();
        const testData1 = `Test file 1 - ${timestamp} - ${Math.random()}`;
        const testData2 = `Test file 2 - ${timestamp} - ${Math.random()}`;

        console.log('=== PINATA DEBUG TEST ===');
        console.log('Test data 1:', testData1);
        console.log('Test data 2:', testData2);

        // Test upload 1 (using form-data package for Node.js)
        const FormDataNode = (await import('form-data')).default;
        const formData1 = new FormDataNode();
        formData1.append('file', Buffer.from(testData1), {
            filename: `test1-${timestamp}.txt`,
            contentType: 'text/plain'
        });

        const response1 = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData1, {
            headers: {
                ...formData1.getHeaders(),
                'Authorization': `Bearer ${PINATA_JWT}`
            },
            timeout: 60000
        });

        console.log('Upload 1 response:', response1.data);

        // Test upload 2
        const formData2 = new FormDataNode();
        formData2.append('file', Buffer.from(testData2), {
            filename: `test2-${timestamp}.txt`,
            contentType: 'text/plain'
        });

        const response2 = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData2, {
            headers: {
                ...formData2.getHeaders(),
                'Authorization': `Bearer ${PINATA_JWT}`
            },
            timeout: 60000
        });

        console.log('Upload 2 response:', response2.data);

        const hash1 = response1.data.IpfsHash;
        const hash2 = response2.data.IpfsHash;

        console.log('Hash 1:', hash1);
        console.log('Hash 2:', hash2);
        console.log('Hashes are same:', hash1 === hash2);

        res.json({
            message: 'Pinata debug test completed',
            test1: {
                data: testData1,
                hash: hash1,
                url: `https://ipfs.io/ipfs/${hash1}`
            },
            test2: {
                data: testData2,
                hash: hash2,
                url: `https://ipfs.io/ipfs/${hash2}`
            },
            hashesAreSame: hash1 === hash2,
            problem: hash1 === hash2 ? 'CRITICAL: Different content returns same hash!' : 'OK: Different content returns different hashes'
        });

    } catch (error) {
        console.error('Pinata debug test failed:', error);
        res.status(500).json({ 
            error: 'Pinata debug test failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Global error handler middleware - MUST be last
app.use((err: any, req: any, res: any, next: any) => {
    console.error('Unhandled error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });

    // Clean up any temp files if error occurred during upload
    if (req.files) {
        const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
        files.forEach((file: any) => {
            if (file.tempFilePath) {
                fs.unlink(file.tempFilePath).catch(console.warn);
            }
        });
    }

    // Don't leak error details in production
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message || 'Something went wrong';

    if (!res.headersSent) {
        res.status(err.status || 500).json({ 
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// --- Server Initialization ---
const startServer = async () => {
    try {
        await initializeDatabase();
        
        const server = app.listen(port, '0.0.0.0', () => {
            console.log(`🚀 Backend server is running on http://0.0.0.0:${port}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`⏱️  Server timeouts configured: ${SERVER_TIMEOUT / 1000}s`);
            console.log(`🔒 Security features enabled: Helmet, Rate Limiting, CORS`);
        });
        
        // Configure server timeouts for file uploads
        server.timeout = SERVER_TIMEOUT;
        server.keepAliveTimeout = SERVER_TIMEOUT;
        server.headersTimeout = SERVER_TIMEOUT + 1000; // Slightly higher than server timeout
        
        // Graceful shutdown handling
        const gracefulShutdown = (signal: string) => {
            console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
            server.close((err) => {
                if (err) {
                    console.error('❌ Error during server shutdown:', err);
                    process.exit(1);
                }
                console.log('✅ Server closed successfully');
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (err) => {
            console.error('💥 Uncaught Exception:', err);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();