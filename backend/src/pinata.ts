import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
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
    console.log(`File data type: ${typeof file.data}, isBuffer: ${Buffer.isBuffer(file.data)}`);
    console.log(`File data length: ${file.data ? file.data.length : 'undefined'}`);
    
    // Log first few bytes of file content for debugging
    if (file.data && file.data.length > 0) {
        const preview = file.data.slice(0, Math.min(50, file.data.length)).toString();
        console.log(`File content preview: ${preview}`);
    }

    // Validate file
    if (!file.data || file.size === 0) {
        throw new Error(`File ${file.name} is empty or has no data`);
    }

    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    const formData = new FormData();
    
    // Use the file buffer from express-fileupload
    formData.append('file', file.data, {
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
            timeout: 60000, // 60 second timeout
            maxContentLength: 100 * 1024 * 1024, // 100MB max
        });

        console.log('Pinata response:', response.data);

        const ipfsHash = response.data.IpfsHash;
        if (!ipfsHash) {
            throw new Error('IPFS hash not found in Pinata response.');
        }
        
        // Construct the full gateway URL - use ipfs.io for better reliability
        const fullUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
        console.log(`File ${file.name} uploaded successfully to: ${fullUrl}`);
        
        // Test the URL to make sure it's accessible
        try {
            const testResponse = await axios.head(fullUrl, { timeout: 10000 });
            console.log(`URL test successful for ${file.name}, status: ${testResponse.status}`);
        } catch (testError) {
            console.warn(`URL test failed for ${file.name}, but continuing:`, testError instanceof Error ? testError.message : 'Unknown error');
        }
        
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