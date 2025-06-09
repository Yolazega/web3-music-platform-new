import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygonAmoy as amoy } from 'wagmi/chains';
import { QueryClient } from '@tanstack/react-query';

export const wagmiConfig = getDefaultConfig({
  appName: 'Web3 Music Platform',
  projectId: '71c23f5b5f6d09f86ec684747eca45cb',
  chains: [amoy],
  ssr: false, // Important for client-side rendering
});

export const queryClient = new QueryClient(); 