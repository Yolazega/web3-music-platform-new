import React, { useState, useEffect } from 'react';
import { useAccount, useBalance, useWalletClient, useWaitForTransactionReceipt } from 'wagmi';
import { burnAxpTokens } from 'contracts/contract';
import { AXP_TOKEN_CONTRACT_ADDRESS, AMOY_CHAIN_ID } from 'config';
import { formatUnits } from 'viem';

interface MusicNFT {
  id: string;
  name: string;
  artist: string;
  priceAXP: string; // Price in AXP tokens
  imageUrl: string; // Placeholder for NFT image
  description: string;
}

// Placeholder NFT data - in a real app, this would come from your smart contract or a backend API
const mockNFTs: MusicNFT[] = [
  {
    id: 'nft1',
    name: 'Genesis Track Alpha',
    artist: 'DJ Metabeat',
    priceAXP: '100',
    imageUrl: 'https://placehold.co/150/FF0000/FFFFFF?text=NFT1',
    description: 'The very first exclusive track from DJ Metabeat.'
  },
  {
    id: 'nft2',
    name: 'Decentralized Dreams',
    artist: 'Satoshi\'s Synth',
    priceAXP: '250',
    imageUrl: 'https://placehold.co/150/00FF00/FFFFFF?text=NFT2',
    description: 'A melodic journey into the world of blockchain.'
  },
  {
    id: 'nft3',
    name: 'Crypto Funk',
    artist: 'The DAO Groovers',
    priceAXP: '75',
    imageUrl: 'https://placehold.co/150/0000FF/FFFFFF?text=NFT3',
    description: 'Get down with this funky beat, powered by smart contracts.'
  },
];

const NFTShop: React.FC = () => {
    const { address, chain } = useAccount();
    const { data: walletClient } = useWalletClient();
    const { data: axpBalance, refetch: fetchAxpBalance } = useBalance({
        address,
        token: AXP_TOKEN_CONTRACT_ADDRESS as `0x${string}`,
    });

    const [nfts] = useState<MusicNFT[]>(mockNFTs);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [purchaseTxHash, setPurchaseTxHash] = useState<`0x${string}` | undefined>();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = 
        useWaitForTransactionReceipt({ 
            hash: purchaseTxHash, 
        });

    useEffect(() => {
        if (isConfirmed) {
            setSuccessMessage(`Successfully burned AXP! Your NFT is (conceptually) minted.`);
            setIsLoading(false);
            setPurchaseTxHash(undefined);
            fetchAxpBalance(); // Refresh balance after successful purchase
        }
    }, [isConfirmed, fetchAxpBalance]);

    const handlePurchase = async (nft: MusicNFT) => {
        if (!walletClient || !address) {
            setError('Please connect your wallet to purchase an NFT.');
            return;
        }
        if (chain?.id.toString() !== parseInt(AMOY_CHAIN_ID, 16).toString()) {
            setError('Please switch to Polygon Amoy Testnet to make purchases.');
            return;
        }
        if (!axpBalance || parseFloat(formatUnits(axpBalance.value, axpBalance.decimals)) < parseFloat(nft.priceAXP)) {
            setError('Insufficient AXP balance to purchase this NFT.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        setPurchaseTxHash(undefined);

        try {
            const hash = await burnAxpTokens(walletClient, nft.priceAXP);
            setPurchaseTxHash(hash);
            setSuccessMessage(`AXP burn transaction submitted: ${hash}. Waiting for confirmation...`);
            // The useEffect hook with useWaitForTransactionReceipt will handle the confirmation.
        } catch (err: any) {
            console.error('Purchase failed:', err);
            setError(err.message || 'NFT purchase failed. Check console and contract interactions.');
            setIsLoading(false);
        }
    };
  
    if (!address) {
        return <p>Please connect your wallet to view the NFT Shop.</p>;
    }

    const isConnectedOnAmoy = chain && chain.id.toString() === parseInt(AMOY_CHAIN_ID, 16).toString();
    const formattedAxpBalance = axpBalance ? parseFloat(formatUnits(axpBalance.value, axpBalance.decimals)) : 0;

    return (
        <div>
            <h2>Music NFT Shop</h2>
            {isLoading && <p>Processing purchase... {isConfirming ? 'Waiting for confirmation...' : ''}</p>}
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}
            {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}

            {!isConnectedOnAmoy && (
                <p style={{color: 'orange'}}>Please switch to Polygon Amoy Testnet to purchase NFTs.</p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                {nfts.map(nft => (
                    <div key={nft.id} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                        <img src={nft.imageUrl} alt={nft.name} style={{ maxWidth: '100%', height: '150px', objectFit: 'cover', marginBottom: '10px' }} />
                        <h3>{nft.name}</h3>
                        <p>Artist: {nft.artist}</p>
                        <p>{nft.description}</p>
                        <p style={{ fontWeight: 'bold', fontSize: '1.2em', margin: '10px 0' }}>Price: {nft.priceAXP} AXP</p>
                        <button 
                            onClick={() => handlePurchase(nft)} 
                            disabled={isLoading || !isConnectedOnAmoy || formattedAxpBalance < parseFloat(nft.priceAXP)}
                            style={{padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer'}}
                        >
                            {isLoading ? 'Processing...' : 'Purchase with AXP'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NFTShop;
