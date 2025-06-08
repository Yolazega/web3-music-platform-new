import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useReadContracts } from 'wagmi';
import { AXEP_VOTING_CONTRACT_ADDRESS } from 'config';
import { axepVotingAbi } from 'contracts/contract';
import type { Address } from 'viem';

// This matches the 'Track' interface on the backend
interface Track {
    id: string;
    artistName: string;
    trackTitle: string;
    genre: string;
    coverImageUrl: string;
    videoUrl: string;
    status: 'pending' | 'approved' | 'rejected' | 'published';
    submittedAt: string;
    reportCount: number;
    transactionHash?: string;
}

// This matches the on-chain Track struct
interface OnChainTrack {
    id: bigint;
    artistId: bigint;
    title: string;
    genre: string;
    videoUrl: string;
    coverImageUrl: string;
    uploadTimestamp: bigint;
    votes: bigint;
}

const AdminPage: React.FC = () => {
    const [submissions, setSubmissions] = useState<Track[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState({ totalSubmissions: 0, pending: 0, approved: 0, rejected: 0 });
    const [totalVotes, setTotalVotes] = useState<number>(0);
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [selectedTrackForPublish, setSelectedTrackForPublish] = useState<Track | null>(null);
    const [manualTransactionHash, setManualTransactionHash] = useState('');

    // --- Fetching on-chain data from the smart contract ---
    const { data: onChainTrackIdsResult } = useReadContracts({
        contracts: [{
            address: AXEP_VOTING_CONTRACT_ADDRESS as Address,
            abi: axepVotingAbi,
            functionName: 'getAllTrackIds',
        }]
    });

    const trackIds = onChainTrackIdsResult?.[0]?.result as bigint[] | undefined;

    const { data: onChainTrackDetails } = useReadContracts({
        contracts: trackIds?.map(id => ({
            address: AXEP_VOTING_CONTRACT_ADDRESS as Address,
            abi: axepVotingAbi,
            functionName: 'getTrack',
            args: [id],
        })) ?? [],
        query: {
            enabled: !!trackIds && trackIds.length > 0,
        }
    });

     useEffect(() => {
        if (onChainTrackDetails) {
            const tracks = onChainTrackDetails.map(res => res.result as OnChainTrack).filter(Boolean);
            const total = tracks.reduce((acc, track) => acc + Number(track.votes), 0);
            setTotalVotes(total);
        }
    }, [onChainTrackDetails]);


    useEffect(() => {
        const loadBackendData = async () => {
            setIsLoading(true);
            try {
                // Fetch both submissions and stats from the backend
                const [submissionsRes, statsRes] = await Promise.all([
                    axios.get('http://localhost:3001/submissions'),
                    axios.get('http://localhost:3001/stats')
                ]);

                // Sort submissions by creation date, newest first
                const sortedSubmissions = submissionsRes.data.sort((a: Track, b: Track) => 
                    new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
                );
                setSubmissions(sortedSubmissions);
                setStats(statsRes.data);

            } catch (err) {
                setError('Failed to load data from the server. Is the backend running?');
                console.error('Data loading error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadBackendData();
    }, []);

    const handleUpdateStatus = async (trackId: string, status: 'approved' | 'rejected') => {
        try {
            await axios.put(`http://localhost:3001/submissions/${trackId}`, { status });
            // Optimistically update the UI
            setSubmissions(submissions.map(s => s.id === trackId ? { ...s, status } : s));
            // Re-fetch stats to update dashboard
            const statsRes = await axios.get('http://localhost:3001/stats');
            setStats(statsRes.data);
        } catch (err) {
            console.error(`Failed to ${status} submission:`, err);
        }
    };

    const handleDelete = async (trackId: string) => {
        if (window.confirm('Are you sure you want to permanently delete this submission?')) {
            try {
                await axios.delete(`http://localhost:3001/submissions/${trackId}`);
                setSubmissions(submissions.filter(s => s.id !== trackId));
                 const statsRes = await axios.get('http://localhost:3001/stats');
                 setStats(statsRes.data);
            } catch (err) {
                console.error('Failed to delete submission:', err);
                setError('Could not delete submission. Please try again.');
            }
        }
    };

    const handleOpenPublishModal = (track: Track) => {
        setSelectedTrackForPublish(track);
        setIsPublishModalOpen(true);
    };

    const handleClosePublishModal = () => {
        setSelectedTrackForPublish(null);
        setIsPublishModalOpen(false);
        setManualTransactionHash('');
    };

    const handleConfirmPublication = async () => {
        if (!selectedTrackForPublish || !manualTransactionHash) {
            alert('Please enter a valid transaction hash.');
            return;
        }

        try {
            // We'll create a new endpoint for this confirmation step
            const response = await axios.post(`http://localhost:3001/submissions/${selectedTrackForPublish.id}/confirm-publication`, {
                transactionHash: manualTransactionHash
            });

            if (response.data.track) {
                // Update the UI
                 setSubmissions(current => 
                    current.map(t => t.id === selectedTrackForPublish.id ? response.data.track : t)
                );
                handleClosePublishModal();
                alert('Publication confirmed successfully!');
            }
        } catch (error) {
            console.error('Failed to confirm publication:', error);
            alert('Failed to confirm publication. See console for details.');
        }
    };

    if (isLoading) {
        return <p>Loading admin dashboard...</p>;
    }

    if (error) {
        return <p style={{ color: 'red' }}>{error}</p>;
    }

    return (
        <div>
            <h2>Admin Dashboard</h2>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', padding: '15px', background: '#f0f0f0', flexWrap: 'wrap' }}>
                <div><strong>Total Submissions:</strong> {stats.totalSubmissions}</div>
                <div><strong>Pending:</strong> {stats.pending}</div>
                <div><strong>Approved:</strong> {stats.approved}</div>
                <div><strong>Rejected:</strong> {stats.rejected}</div>
                <div style={{ borderLeft: '2px solid #ccc', paddingLeft: '20px' }}>
                    <strong>Total On-Chain Votes:</strong> {totalVotes}
                </div>
            </div>

            <h3>Track Submissions for Review</h3>
            {submissions.length === 0 ? (
                <p>No new submissions.</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={tableHeaderStyle}>Submitted</th>
                            <th style={tableHeaderStyle}>Artist</th>
                            <th style={tableHeaderStyle}>Track Title</th>
                            <th style={tableHeaderStyle}>Genre</th>
                            <th style={tableHeaderStyle}>Reports</th>
                            <th style={tableHeaderStyle}>Status</th>
                            <th style={tableHeaderStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {submissions.map(track => (
                            <tr key={track.id} style={{ backgroundColor: track.status === 'approved' ? '#e6ffed' : track.status === 'rejected' ? '#ffebee' : track.status === 'published' ? '#e3f2fd' : 'white' }}>
                                <td style={tableCellStyle}>{new Date(track.submittedAt).toLocaleString()}</td>
                                <td style={tableCellStyle}>{track.artistName}</td>
                                <td style={tableCellStyle}>{track.trackTitle}</td>
                                <td style={tableCellStyle}>{track.genre}</td>
                                <td style={{...tableCellStyle, color: track.reportCount > 0 ? 'red' : 'inherit', fontWeight: track.reportCount > 0 ? 'bold' : 'normal' }}>
                                    {track.reportCount}
                                </td>
                                <td style={tableCellStyle}>{track.status}</td>
                                <td style={tableCellStyle}>
                                    <a href={track.coverImageUrl} target="_blank" rel="noopener noreferrer">Cover</a>
                                    {' | '}
                                    <a href={track.videoUrl} target="_blank" rel="noopener noreferrer">Video</a>
                                    {track.status === 'pending' && (
                                        <>
                                            {' | '}
                                            <button onClick={() => handleUpdateStatus(track.id, 'approved')} style={{ color: 'green', marginLeft: '10px' }}>Approve</button>
                                            <button onClick={() => handleUpdateStatus(track.id, 'rejected')} style={{ color: 'red', marginLeft: '5px' }}>Reject</button>
                                        </>
                                    )}
                                    {track.status === 'approved' && (
                                         <button onClick={() => handleOpenPublishModal(track)} style={{ color: 'blue', marginLeft: '10px' }}>Publish</button>
                                    )}
                                    <button onClick={() => handleDelete(track.id)} style={{ color: 'black', marginLeft: '10px' }}>Delete</button>
                                 </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {isPublishModalOpen && selectedTrackForPublish && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3>Publish Track Manually</h3>
                        <p>To publish this track, connect your Ledger wallet to a tool like Remix or the Polygon Wallet Suite and call the <strong>`registerArtistAndUploadFirstTrack`</strong> function on your contract with the following parameters:</p>
                        
                        <ul style={{ listStyleType: 'none', padding: 0 }}>
                            <li><strong>artistName (string):</strong> {selectedTrackForPublish.artistName}</li>
                            <li><strong>trackTitle (string):</strong> {selectedTrackForPublish.trackTitle}</li>
                            <li><strong>genre (string):</strong> {selectedTrackForPublish.genre}</li>
                            <li><strong>videoUrl (string):</strong> {selectedTrackForPublish.videoUrl}</li>
                            <li><strong>coverImageUrl (string):</strong> {selectedTrackForPublish.coverImageUrl}</li>
                        </ul>

                        <p>After submitting the transaction, paste the transaction hash below to update the track's status.</p>
                        
                        <input 
                            type="text" 
                            value={manualTransactionHash}
                            onChange={(e) => setManualTransactionHash(e.target.value)}
                            placeholder="0x..."
                            style={{ width: '95%', padding: '8px', marginBottom: '15px' }}
                        />

                        <button onClick={handleConfirmPublication} style={{ marginRight: '10px' }}>Confirm Publication</button>
                        <button onClick={handleClosePublishModal}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const tableHeaderStyle: React.CSSProperties = {
    borderBottom: '2px solid #333',
    padding: '8px',
    textAlign: 'left'
};

const tableCellStyle: React.CSSProperties = {
    borderBottom: '1px solid #ccc',
    padding: '8px'
};

const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
};

const modalContentStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '5px',
    width: '600px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
};

export default AdminPage;
