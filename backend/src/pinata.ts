import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import fs from 'fs';
import { UploadedFile } from 'express-fileupload';

dotenv.config();

// Try multiple IPFS gateways for better reliability
const IPFS_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/'
];

const IPFS_GATEWAY_URL = process.env.IPFS_GATEWAY_URL || IPFS_GATEWAYS[0];

export const uploadToPinata = async (file: UploadedFile): Promise<string> => {
    const PINATA_JWT = process.env.PINATA_JWT;
    if (!PINATA_JWT) {
        throw new Error('Pinata JWT is not configured on the server.');
    }

    console.log(`Starting Pinata upload for file: ${file.name} (${file.size} bytes, ${file.mimetype})`);
    
    // CRITICAL FIX: Handle useTempFiles=true case
    let fileBuffer: Buffer;
    
    if (file.tempFilePath) {
        // When useTempFiles=true, file.data is undefined and we need to read from tempFilePath
        console.log(`Reading file from temp path: ${file.tempFilePath}`);
        try {
            fileBuffer = fs.readFileSync(file.tempFilePath);
            console.log(`Successfully read ${fileBuffer.length} bytes from temp file`);
        } catch (error) {
            console.error('Error reading temp file:', error);
            throw new Error(`Failed to read temporary file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    } else if (file.data && Buffer.isBuffer(file.data)) {
        // When useTempFiles=false, file.data contains the buffer
        console.log(`Using file data buffer directly (${file.data.length} bytes)`);
        fileBuffer = file.data;
    } else {
        console.error('No valid file data found:', {
            hasData: !!file.data,
            dataType: typeof file.data,
            isBuffer: file.data ? Buffer.isBuffer(file.data) : false,
            hasTempPath: !!file.tempFilePath,
            tempPath: file.tempFilePath
        });
        throw new Error(`File ${file.name} has no accessible data`);
    }

    // Log first few bytes for debugging (but not for binary files)
    if (fileBuffer.length > 0 && file.mimetype?.startsWith('text/')) {
        const preview = fileBuffer.slice(0, Math.min(50, fileBuffer.length)).toString();
        console.log(`File content preview: ${preview}`);
    } else {
        console.log(`Binary file detected (${file.mimetype}), skipping content preview`);
    }

    // Validate file
    if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error(`File ${file.name} is empty or has no data`);
    }

    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    const formData = new FormData();
    
    // Use the file buffer we just read
    formData.append('file', fileBuffer, {
        filename: file.name,
        contentType: file.mimetype
    });

    try {
        console.log(`Uploading ${file.name} to Pinata...`);
        const response = await axios.post(url, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${PINATA_JWT}`
            },
            timeout: 120000, // 2 minute timeout for 90-second videos
            maxContentLength: 30 * 1024 * 1024, // 30MB max for 90-second videos
        });

        console.log('Pinata response status:', response.status);
        console.log('Pinata response data:', JSON.stringify(response.data, null, 2));

        const ipfsHash = response.data.IpfsHash;
        if (!ipfsHash) {
            throw new Error('IPFS hash not found in Pinata response.');
        }
        
        // Construct the full gateway URL - use ipfs.io for better reliability
        const fullUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
        console.log(`File ${file.name} uploaded successfully to: ${fullUrl}`);
        
        // Skip URL verification to avoid timeout issues
        // The file should be available on IPFS within a few minutes
        console.log(`IPFS Hash: ${ipfsHash}`);
        
        return fullUrl;
    } catch (error) {
        console.error(`Error uploading ${file.name} to Pinata:`, error);
        if (axios.isAxiosError(error)) {
            console.error('Pinata API Error:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            });
        }
        throw new Error(`Failed to upload ${file.name} to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}; 