export interface Track {
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
  submissionDate: string;
  artistWallet: string;
  onChainTrackId?: string;
}

export type Genre = string; 