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
        
        // Construct the full gateway URL
        const fullUrl = `${IPFS_GATEWAY_URL}${ipfsHash}`;
        console.log(`File ${file.name} uploaded successfully to: ${fullUrl}`);
        
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