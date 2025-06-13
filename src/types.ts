export interface Track {
  id: string;
  title: string;
  artist: string;
  artistWallet: string;
  filePath: string;
  ipfsHash: string;
  status: 'pending' | 'approved' | 'rejected' | 'published' | 'archived';
  onChainId?: number;
  votes: number;
  weekNumber: number;
  coverImageUrl?: string;
  videoUrl?: string;
  submittedAt: string;
}

export interface Share {
  id: string;
  trackId: string;
  userId: string;
  platform: string;
  proofUrl: string;
  status: 'pending' | 'verified' | 'rejected';
  weekNumber: number;
}

export interface Vote {
  id: string;
  trackId: string;
  voterAddress: string;
  timestamp: number;
  status: 'unprocessed' | 'processed' | 'tallied';
  weekNumber: number;
}

export type Genre = string; 