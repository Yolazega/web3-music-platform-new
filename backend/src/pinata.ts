import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

const IPFS_GATEWAY_URL = process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/';

export const uploadToPinata = async (file: Express.Multer.File): Promise<string> => {
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
    
    let gatewayUrl = `${IPFS_GATEWAY_URL}${ipfsHash}`;

    if (file.mimetype.startsWith('video/')) {
        const originalFilename = encodeURIComponent(file.originalname);
        gatewayUrl = `${gatewayUrl}?filename=${originalFilename}`;
    }

    return gatewayUrl;
}; 