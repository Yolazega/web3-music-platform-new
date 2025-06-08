import { create, IPFSHTTPClient } from 'ipfs-http-client';
import { IPFS_GATEWAY_URL } from '../config'; // Import gateway URL
import { Buffer } from 'buffer';

let ipfs: IPFSHTTPClient | undefined;

const INFURA_PROJECT_ID = '2PTV11wE4x3w2Is5f7bLhXy8d4j';
const INFURA_SECRET_KEY = '809b0b46766d77e48679f871ddc95eda';
const INFURA_IPFS_ENDPOINT = 'https://ipfs.infura.io:5001';

try {
  const auth = 'Basic ' + Buffer.from(INFURA_PROJECT_ID + ':' + INFURA_SECRET_KEY).toString('base64');
  
  ipfs = create({
    url: INFURA_IPFS_ENDPOINT,
    headers: {
      authorization: auth,
    },
  });
  console.log('IPFS client initialized with Infura.');
} catch (error) {
  console.error('Failed to initialize IPFS client with Infura:', error);
  ipfs = undefined;
}

/**
 * Uploads a file (e.g., audio, image) to IPFS.
 * @param file The file to upload.
 * @returns The IPFS hash (CID string) of the uploaded file.
 * @throws Error if IPFS client is not available or upload fails.
 */
export const uploadFileToIPFS = async (file: File): Promise<string> => {
  if (!ipfs) {
    throw new Error(
      'IPFS client is not initialized. Check connection to IPFS node or configuration.'
    );
  }

  try {
    const added = await ipfs.add(file, { pin: true }); // Optionally pin the content
    console.log('Successfully uploaded file to IPFS. CID:', added.cid.toString());
    return added.cid.toString();
  } catch (error) {
    console.error('Error uploading file to IPFS:', error);
    throw new Error('Failed to upload file to IPFS. Check console for details.');
  }
};

/**
 * Represents the metadata structure for a track to be stored on IPFS.
 */
export interface TrackMetadata {
  title: string;
  artistName: string; // Name of the artist performing
  uploaderAddress: string; // Wallet address of the person uploading
  audioIpfsCid?: string; // CID of the main audio file - NOW OPTIONAL
  coverImageIpfsCid?: string; // Optional CID of a cover image
  videoIpfsCid?: string; // Optional CID for a video file
  description?: string; // Optional track description
  lyricsIpfsCid?: string; // Optional CID for lyrics file
  uploadedAt: string; // ISO string timestamp
  // Add any other relevant fields
}

/**
 * Uploads JSON metadata (e.g., for a track or NFT) to IPFS.
 * @param metadata The JSON object (TrackMetadata) to upload.
 * @returns The IPFS hash (CID string) of the uploaded JSON.
 * @throws Error if IPFS client is not available or upload fails.
 */
export const uploadJsonToIPFS = async (metadata: TrackMetadata): Promise<string> => {
  if (!ipfs) {
    throw new Error(
      'IPFS client is not initialized. Check connection to IPFS node or configuration.'
    );
  }
  try {
    // Create a Blob from the JSON string
    const jsonBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    const added = await ipfs.add(jsonBlob, { pin: true }); // Optionally pin the metadata
    console.log('Successfully uploaded JSON metadata to IPFS. CID:', added.cid.toString());
    return added.cid.toString();
  } catch (error) {
    console.error('Error uploading JSON metadata to IPFS:', error);
    throw new Error('Failed to upload JSON metadata to IPFS. Check console for details.');
  }
};

/**
 * Constructs a public gateway URL for an IPFS CID.
 * @param cid The IPFS CID (string).
 * @returns A full URL to access the content via a public IPFS gateway.
 */
export const getIpfsGatewayUrl = (cid: string | null | undefined): string => {
  if (!cid) return ''; // Return empty string or a placeholder image/link if CID is null/undefined
  return `${IPFS_GATEWAY_URL}${cid}`;
}; 