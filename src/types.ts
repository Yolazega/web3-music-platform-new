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
}

export type Genre = string; 