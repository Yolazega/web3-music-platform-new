import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { AXP_TOKEN_CONTRACT_ADDRESS, AMOY_CHAIN_ID } from './config'; // Corrected import path

// ABI fragment for the balanceOf function of an ERC20 token
const erc20Abi = [
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  }
];

// Replace with your actual AXP token contract address on Polygon Amoy Testnet
// const AXP_TOKEN_CONTRACT_ADDRESS = '0xa1edD20366dbAc7341DE5fdb9FE1711Fb9EAD4d4'; // Commented out or removed
// Polygon Amoy Testnet Chain ID
// const AMOY_CHAIN_ID = '0x13882'; // Commented out or removed, imported from config

const WalletLogin: React.FC = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [axpBalance, setAxpBalance] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  useEffect(() => {
    let browserProvider: ethers.BrowserProvider | null = null;
    let accountsChangedCb: ((accounts: string[]) => void) | null = null;
    let chainChangedCb: ((chainId: string) => void) | null = null;

    if (window.ethereum) {
      browserProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(browserProvider);

      accountsChangedCb = (accounts: string[]) => {
        if (accounts.length > 0 && browserProvider) {
          handleAccountsChanged(accounts[0], browserProvider);
        } else {
          setWalletAddress(null);
          setAxpBalance(null);
          setErrorMessage('Wallet disconnected.');
        }
      };

      chainChangedCb = (chainId: string) => {
        console.log('Network changed to:', chainId);
        if (walletAddress && browserProvider) {
          checkNetworkAndFetchBalance(walletAddress, browserProvider);
        }
      };

      window.ethereum.on('accountsChanged', accountsChangedCb);
      window.ethereum.on('chainChanged', chainChangedCb);

    } else {
      setErrorMessage('MetaMask is not installed. Please install it to use this feature.');
    }

    // Cleanup listeners when component unmounts
    return () => {
      if (window.ethereum && typeof window.ethereum.removeListener === 'function') {
        if (accountsChangedCb) {
          window.ethereum.removeListener('accountsChanged', accountsChangedCb);
        }
        if (chainChangedCb) {
          window.ethereum.removeListener('chainChanged', chainChangedCb);
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]); // Rerun effect if walletAddress changes to re-check network

  const handleAccountsChanged = async (account: string, currentProvider: ethers.BrowserProvider) => {
    setWalletAddress(account);
    setErrorMessage(null);
    await checkNetworkAndFetchBalance(account, currentProvider);
  };

  const checkNetworkAndFetchBalance = async (account: string, currentProvider: ethers.BrowserProvider) => {
    try {
      const network = await currentProvider.getNetwork();
      if (network.chainId.toString() !== BigInt(AMOY_CHAIN_ID).toString()) {
        setErrorMessage(`Please connect to Polygon Amoy Testnet. Current network: ${network.name} (ID: ${network.chainId})`);
        setAxpBalance(null);
        // Optionally, prompt to switch network
        // await switchToAmoyNetwork(currentProvider);
        return;
      }
      setErrorMessage(null); // Clear error if on correct network
      await fetchAxpBalance(account, currentProvider);
    } catch (error) {
      console.error('Error checking network or fetching balance:', error);
      setErrorMessage('Error checking network or fetching balance.');
      setAxpBalance(null);
    }
  };

  const switchToAmoyNetwork = async (currentProvider: ethers.BrowserProvider) => {
    try {
      await currentProvider.send('wallet_switchEthereumChain', [{ chainId: AMOY_CHAIN_ID }]);
      // Refresh data once switched
      if (walletAddress) {
        await checkNetworkAndFetchBalance(walletAddress, currentProvider);
      }
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await currentProvider.send('wallet_addEthereumChain', [
            {
              chainId: AMOY_CHAIN_ID,
              chainName: 'Polygon Amoy Testnet',
              rpcUrls: ['https://rpc-amoy.polygon.technology/'],
              nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18,
              },
              blockExplorerUrls: ['https://amoy.polygonscan.com/'],
            },
          ]);
          // Refresh data once network added and switched
          if (walletAddress) {
            await checkNetworkAndFetchBalance(walletAddress, currentProvider);
          }
        } catch (addError) {
          console.error('Failed to add the Amoy network:', addError);
          setErrorMessage('Failed to add or switch to Amoy network. Please do it manually in MetaMask.');
        }
      } else {
        console.error('Failed to switch to the Amoy network:', switchError);
        setErrorMessage('Failed to switch to Amoy network. Please do it manually in MetaMask.');
      }
    }
  };


  const connectWallet = async () => {
    if (!provider) {
      setErrorMessage('MetaMask provider not available. Please ensure MetaMask is installed and active.');
      return;
    }
    setErrorMessage(null);
    try {
      const accounts = await provider.send('eth_requestAccounts', []);
      if (accounts && accounts.length > 0) {
        const account = accounts[0];
        setWalletAddress(account);
        await checkNetworkAndFetchBalance(account, provider);
      } else {
        setErrorMessage('No accounts found. Please ensure your MetaMask wallet is unlocked and has accounts.');
      }
    } catch (error: any) {
      console.error('Error connecting to MetaMask:', error);
      if (error.code === 4001) {
        setErrorMessage('Connection request denied. Please approve the connection in MetaMask.');
      } else {
        setErrorMessage('Failed to connect wallet. See console for details.');
      }
      setWalletAddress(null);
      setAxpBalance(null);
    }
  };

  const fetchAxpBalance = async (account: string, currentProvider: ethers.BrowserProvider) => {
    if (!account || !currentProvider) return;

    try {
      const signer = await currentProvider.getSigner(account);
      const tokenContract = new ethers.Contract(AXP_TOKEN_CONTRACT_ADDRESS, erc20Abi, signer);
      const balance = await tokenContract.balanceOf(account);
      setAxpBalance(ethers.formatUnits(balance, 18)); // Assuming 18 decimals
      setErrorMessage(null); 
    } catch (error) {
      console.error('Error fetching AXP token balance:', error);
      setErrorMessage('Failed to fetch AXP token balance. Ensure the contract address is correct and you are on Polygon Amoy Testnet.');
      setAxpBalance(null);
    }
  };

  return (
    <div>
      <h2>Wallet Connect</h2>
      {!walletAddress ? (
        <button onClick={connectWallet} disabled={!provider}>
          {provider ? 'Connect Wallet' : 'Loading MetaMask...'}
        </button>
      ) : (
        <div>
          <p><strong>Wallet Address:</strong> {walletAddress}</p>
          {axpBalance !== null ? (
            <p><strong>AXP Token Balance:</strong> {axpBalance} AXP</p>
          ) : (
            <p>Fetching AXP balance...</p>
          )}
          <button onClick={() => checkNetworkAndFetchBalance(walletAddress, provider!)} disabled={!provider}>
            Refresh Balance
          </button>
           <button onClick={() => switchToAmoyNetwork(provider!)} disabled={!provider}>
            Switch to Amoy Testnet
          </button>
        </div>
      )}
      {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
    </div>
  );
};

export default WalletLogin; 