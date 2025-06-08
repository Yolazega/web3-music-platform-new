import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useReadContracts } from 'wagmi';
import { AXEP_VOTING_CONTRACT_ADDRESS, AMOY_CHAIN_ID } from 'config';
import { axepVotingAbi } from 'contracts/contract';
import { type Abi } from 'viem';
import api from '../services/api';
import axios from 'axios';

// Define a type for the track data returned by the contract
interface Track {
    id: bigint;
    artistId: bigint;
    title: string;
    genre: string;
    videoUrl: string;
    coverImageUrl: string;
    uploadTimestamp: bigint;
    votes: bigint;
}

const VotingPage: React.FC = () => {
    const { address, chain } = useAccount();
    const { data: hash, writeContract, isPending: isVoting, error: writeError } = useWriteContract();

    const [tracks, setTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [reportedTracks, setReportedTracks] = useState<Set<bigint>>(new Set());

    const { data: allTrackIds, error: trackIdsError, isLoading: isLoadingTrackIds } = useReadContract({
        address: AXEP_VOTING_CONTRACT_ADDRESS,
        abi: axepVotingAbi,
        functionName: 'getAllTrackIds',
    });

    const trackIds = allTrackIds as bigint[] | undefined;

    const { data: trackDetailsData, error: trackDetailsError, isLoading: isLoadingTrackDetails } = useReadContracts({
        contracts: trackIds?.map(id => ({
            address: AXEP_VOTING_CONTRACT_ADDRESS as `0x${string}`,
            abi: axepVotingAbi,
            functionName: 'getTrack',
            args: [id],
        })) ?? [],
        query: {
            enabled: !!trackIds && trackIds.length > 0,
        }
    });

    useEffect(() => {
        const fetchTracks = async () => {
            try {
                setLoading(true);
                const response = await api.get('/submissions?status=approved');
                setTracks(response.data);
            } catch (err) {
                console.error('Failed to fetch tracks:', err);
                setError('Failed to fetch tracks. Please try again later.');
            }
        };

        fetchTracks();
    }, []);

    const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } = useWaitForTransactionReceipt({ hash });

    const isConnectedOnAmoy = address && chain && chain.id.toString() === parseInt(AMOY_CHAIN_ID, 16).toString();

    const handleVote = (trackId: bigint) => {
        if (!address) {
            setError('Please connect your wallet to vote.');
            return;
        }
        setError(null);
        writeContract({
            address: AXEP_VOTING_CONTRACT_ADDRESS,
            abi: axepVotingAbi,
            functionName: 'voteForTrack',
            args: [trackId],
        });
    };
    
    const handleReport = async (trackId: bigint) => {
        if (!address) {
            alert('Please connect your wallet to report a track.');
            return;
        }
        if (window.confirm('Are you sure you want to report this track?')) {
            try {
                await api.post(`/submissions/${trackId.toString()}/report`);
                alert('Track reported successfully. Thank you for your feedback.');
                setReportedTracks(prev => new Set(prev).add(trackId));
            } catch (err) {
                console.error('Failed to report track:', err);
                setError('Failed to report track. Please try again later.');
            }
        }
    };

    const isLoading = isLoadingTrackIds || isLoadingTrackDetails;

    if (!address) return <p>Please connect your wallet to view and vote for tracks.</p>;
    if (!isConnectedOnAmoy) {
        return <p>Please switch to the Polygon Amoy Testnet to access the voting page.</p>;
    }

    return (
        <div>
            <h2>Vote for Your Favorite Tracks</h2>
            <p>Your vote helps artists gain visibility. Cast your vote for the tracks you love!</p>

            {isLoading && <p>Loading tracks...</p>}
            
            {(error || writeError || receiptError || trackIdsError || trackDetailsError) && (
                <p style={{ color: 'red' }}>
                    Error: {error || writeError?.message || receiptError?.message || trackIdsError?.message || trackDetailsError?.message}
                </p>
            )}

            {isVoting && <p><i>Sending your vote to your wallet...</i></p>}
            {isConfirming && <p><i>Confirming your vote on the blockchain...</i></p>}
            {isConfirmed && <p style={{ color: 'green' }}>Vote successfully cast!</p>}

            {!isLoading && tracks.length === 0 && (
                <p>No tracks have been uploaded yet. Be the first to <a href="/upload">upload a track</a>!</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {tracks.map(track => (
                    <div key={track.id.toString()} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px' }}>
                        <img 
                            src={track.coverImageUrl} 
                            alt={`Cover for ${track.title}`}
                            style={{width: '150px', height: '150px', objectFit: 'cover', float: 'left', marginRight: '15px'}}
                        />
                        <h3>{track.title}</h3>
                        <p><strong>Genre:</strong> {track.genre}</p>
                        <p><strong>Votes:</strong> {track.votes.toString()}</p>
                        <a href={track.videoUrl} target="_blank" rel="noopener noreferrer">Watch Video</a>
                        <br /><br />
                        <button 
                            onClick={() => handleVote(track.id)}
                            disabled={isVoting || isConfirming}
                        >
                            Vote for this Track
                        </button>
                        <button
                            onClick={() => handleReport(track.id)}
                            disabled={reportedTracks.has(track.id)}
                            style={{ marginLeft: '10px', color: reportedTracks.has(track.id) ? 'grey' : 'orange' }}
                        >
                            {reportedTracks.has(track.id) ? 'Reported' : 'Report'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VotingPage;
