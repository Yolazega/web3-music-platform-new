import axios from 'axios';
import { IPFS_GATEWAY_URL } from 'config';

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;

if (!PINATA_JWT) {
    console.error("Pinata JWT is missing from .env file. Uploads will not work.");
}

/**
 * Uploads a file to Pinata IPFS and returns the full gateway URL.
 * @param file The file to upload (e.g., from an <input type="file"> element).
 * @returns The full HTTPS URL to the file on the IPFS gateway.
 */
export const uploadFileToIPFS = async (file: File): Promise<string> => {
    if (!PINATA_JWT) {
        throw new Error("Pinata JWT is not configured. Cannot upload file.");
    }

    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;

    // Create a FormData object to hold the file
    const data = new FormData();
    data.append('file', file);

    try {
        const response = await axios.post(url, data, {
            maxBodyLength: Infinity, // This is needed to upload large files
            headers: {
                'Authorization': `Bearer ${PINATA_JWT}`
            }
        });

        const ipfsHash = response.data.IpfsHash;
        if (!ipfsHash) {
            throw new Error("IPFS hash not found in Pinata response.");
        }
        
        // Return the full gateway URL
        return `${IPFS_GATEWAY_URL}${ipfsHash}`;

    } catch (error) {
        console.error("Error uploading file to Pinata: ", error);
        throw new Error("Failed to upload file to IPFS.");
    }
};

// FormData.getBoundary() is not a standard method on the browser's FormData.
// We need to add it to the prototype for axios to work correctly with form data.
declare global {
    interface FormData {
        getBoundary(): string;
    }
}
if (typeof FormData.prototype.getBoundary !== 'function') {
    FormData.prototype.getBoundary = function() {
        // A simplified boundary creation. In a real-world scenario, you might want something more robust.
        return `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
    };
} 