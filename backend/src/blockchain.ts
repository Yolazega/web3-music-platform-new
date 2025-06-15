import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { AXEP_VOTING_CONTRACT_ABI } from './contractAbi'; // We will create this file next

dotenv.config();

const AMOY_RPC_URL = process.env.AMOY_RPC_URL;
const CONTRACT_ADDRESS = process.env.AXEP_VOTING_CONTRACT_ADDRESS;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

if (!AMOY_RPC_URL || !CONTRACT_ADDRESS || !ADMIN_PRIVATE_KEY) {
    throw new Error("Missing required environment variables for blockchain interaction.");
}

const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, AXEP_VOTING_CONTRACT_ABI, wallet);

interface TrackData {
    artistWallets: string[];
    artistNames: string[];
    trackTitles: string[];
    genres: string[];
    videoUrls: string[];
    coverImageUrls: string[];
}

export const registerTracksOnChain = async (trackData: TrackData) => {
    try {
        console.log("Attempting to register tracks on-chain...");
        const tx = await contract.batchRegisterAndUpload(
            trackData.artistWallets,
            trackData.artistNames,
            trackData.trackTitles,
            trackData.genres,
            trackData.videoUrls,
            trackData.coverImageUrls,
            { gasLimit: 5000000 } // Setting a higher gas limit
        );

        console.log(`Transaction sent! Hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Transaction confirmed! Block Number: ${receipt.blockNumber}`);
        
        // --- Parsing Logs to get on-chain IDs ---
        const trackUploadedTopic = contract.interface.getEvent('TrackUploaded').topicHash;
        
        const onChainIds = receipt.logs
            .filter((log: any) => log.topics[0] === trackUploadedTopic)
            .map((log: any) => {
                const parsedLog = contract.interface.parseLog(log);
                return {
                    onChainId: parsedLog.args.trackId.toString(),
                    videoUrl: parsedLog.args.videoUrl, // Use videoUrl as a key to map back
                };
            });
            
        console.log("Parsed on-chain IDs:", onChainIds);
        return { receipt, onChainIds };

    } catch (error) {
        console.error("Error in registerTracksOnChain:", error);
        throw error; // Re-throw the error to be handled by the caller
    }
}; 