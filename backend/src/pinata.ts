import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const IPFS_GATEWAY_URL = process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/';

export const uploadToPinata = async (file: Express.Multer.File): Promise<string> => {
    const PINATA_JWT = process.env.PINATA_JWT;
    if (!PINATA_JWT) {
        throw new Error('Pinata JWT is not configured on the server.');
    }
    if (!file.path) {
        throw new Error('File path is missing. Ensure multer is using disk storage.');
    }

    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    const formData = new FormData();
    const fileStream = fs.createReadStream(file.path);

    formData.append('file', fileStream, {
        filename: file.originalname,
        contentType: file.mimetype
    });

    try {
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
        
        let gatewayUrl = `${IPFS_GATEWAY_URL}${ipfsHash}`;

        if (file.mimetype.startsWith('video/')) {
            const originalFilename = encodeURIComponent(file.originalname);
            gatewayUrl = `${gatewayUrl}?filename=${originalFilename}`;
        }

        return gatewayUrl;
    } finally {
        // Always attempt to clean up the temporary file
        fileStream.close();
        fs.unlink(file.path, (err) => {
            if (err) {
                console.error(`Failed to delete temporary file: ${file.path}`, err);
            }
        });
    }
}; 