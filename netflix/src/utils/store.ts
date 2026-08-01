import { create } from 'zustand';
import { api } from '../services/movieService';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverArtUrl: string;
  youtubeVideoId?: string; // known upfront → VideoPlayer skips the fetch-video call
}

interface PlayerState {
  currentTrack: Track | null;
  playlist: Track[];
  isPlayerOpen: boolean;
  openPlayer:  (track: Track, playlist?: Track[]) => void;
  closePlayer: () => void;
  // Legacy aliases so existing call-sites compile without changes
  playTrack: (track: Track) => void;
  stopTrack: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentTrack: null,
  playlist: [],
  isPlayerOpen: false,

  openPlayer:  (track, playlist = []) => set({ currentTrack: track, playlist, isPlayerOpen: true }),
  closePlayer: ()      => set({ isPlayerOpen: false }),

  // Legacy aliases → both just delegate to the canonical actions
  playTrack: (track) => set({ currentTrack: track, isPlayerOpen: true }),
  stopTrack: ()      => set({ isPlayerOpen: false, currentTrack: null, playlist: [] }),
}));

interface LikeState {
  likedIds: Record<string, boolean>;
  isLoaded: boolean;
  fetchLikes: () => Promise<void>;
  toggleLike: (id: string, isLiked: boolean) => void;
}

export const useLikeStore = create<LikeState>((set) => ({
  likedIds: {},
  isLoaded: false,
  fetchLikes: async () => {
    try {
      const res = await api.get('/telemetry/my-list');
      const ids: Record<string, boolean> = {};
      (res.data.albums || []).forEach((a: any) => { ids[String(a.id)] = true; });
      (res.data.tracks || []).forEach((t: any) => { ids[String(t.id)] = true; });
      set({ likedIds: ids, isLoaded: true });
    } catch (err) {
      console.error('Failed to fetch likes', err);
    }
  },
  toggleLike: (id, isLiked) => set((state) => ({
    likedIds: { ...state.likedIds, [id]: isLiked }
  })),
}));