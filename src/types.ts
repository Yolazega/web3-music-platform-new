export interface Track {
  id: string;
  artistId: string;
  ipfsHash: string;
  uploadTimestamp: number;
  votingWeek: number;
  isActive: boolean;
  genre: string;
  title?: string;
  artistName?: string;
  audioIpfsCid?: string;
  coverImageIpfsCid?: string;
  votes?: number;
}

export type Genre = string; 