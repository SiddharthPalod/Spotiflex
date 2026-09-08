import { useEffect, useRef, useState, useCallback } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { ArrowLeftIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { usePlayerStore, Track } from '../utils/store';
import { fetchVideoId, api, fetchSimilarTracks } from '../services/movieService';
import { normalizeSongTitle } from '../utils/trackHelper';
import YouTubeImage from './YouTubeImage';

type LoadState = 'loading' | 'ready' | 'error';

export default function VideoPlayer() {
  const { currentTrack, playlist, isPlayerOpen, openPlayer, closePlayer } = usePlayerStore();

  const [videoId,      setVideoId]      = useState<string | null>(null);
  const [loadState,    setLoadState]    = useState<LoadState>('loading');
  const [showChrome,   setShowChrome]   = useState(true);
  
  // Up Next state
  const [upNextTrack,  setUpNextTrack]  = useState<Track | null>(null);
  const [upNextTimer,  setUpNextTimer]  = useState<number | null>(null);
  
  const hideTimer     = useRef<ReturnType<typeof setTimeout>>();
  const nextTimerRef  = useRef<ReturnType<typeof setInterval>>();
  const progressTimerRef = useRef<ReturnType<typeof setInterval>>();
  const hasTriggeredUpNextRef = useRef(false);
  const playerRef = useRef<any>(null);
  const playedIdsRef = useRef<Set<string>>(new Set());
  const playedTitlesRef = useRef<Set<string>>(new Set());
  const prefetchedNextTrackRef = useRef<{ track: Track; playlist: Track[] } | null>(null);

  // Telemetry tracking
  const durationWatchedRef = useRef(0);
  const playStartTimeRef   = useRef(0);
  // Tracks HOW the current song was exited before the next render cycle fires.
  // Values: 'closed' | 'manual' | 'auto' | null (natural end = completed)
  const skipSourceRef      = useRef<'closed' | 'manual' | 'auto' | null>('closed');
  // Snapshot of the track at exit time (currentTrack may already be updated in the store)
  const exitTrackRef       = useRef<typeof currentTrack>(null);

  // ── Resolve video ID and prefetch next track when a track opens ─────────
  useEffect(() => {
    if (!isPlayerOpen || !currentTrack) return;

    // Fix ghost timers: reset all progress and up-next states on new track
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (nextTimerRef.current) clearInterval(nextTimerRef.current);
    setUpNextTrack(null);
    setUpNextTimer(null);
    hasTriggeredUpNextRef.current = false;
    prefetchedNextTrackRef.current = null;

    // Reset skip source for new track (default: closed until proven otherwise)
    skipSourceRef.current = 'closed';
    
    // Add to session history to prevent A -> B -> A loops
    playedIdsRef.current.add(String(currentTrack.id));
    if (currentTrack.title || (currentTrack as any).name) {
      playedTitlesRef.current.add(normalizeSongTitle(currentTrack.title || (currentTrack as any).name));
    }

    // ── Prefetch next track + YouTube video ID in background for instantaneous background transition
    const prefetchNextTrack = async () => {
      let next: Track | null = null;
      let nextPlaylist: Track[] = playlist;

      const currentIndex = playlist.findIndex((t) => String(t.id) === String(currentTrack.id));
      if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
        next = playlist[currentIndex + 1];
      } else {
        const excludeIds = Array.from(playedIdsRef.current);
        try {
          const recs = await fetchSimilarTracks(String(currentTrack.id), currentTrack.artist, currentTrack.title, excludeIds);
          next = recs.find((t: any) => {
            const tId = String(t.id);
            const tNorm = normalizeSongTitle(t.title || t.name);
            return !playedIdsRef.current.has(tId) && (!tNorm || !playedTitlesRef.current.has(tNorm));
          }) || null;
          nextPlaylist = recs;
        } catch {}
      }

      if (next) {
        let yId = next.youtubeVideoId;
        if (!yId) {
          try {
            yId = await fetchVideoId(next.title, next.artist);
          } catch {}
        }
        prefetchedNextTrackRef.current = {
          track: { ...next, youtubeVideoId: yId || undefined },
          playlist: nextPlaylist,
        };
      }
    };
    prefetchNextTrack();

    // ── Load or switch video in player
    const playResolvedVideo = (targetVideoId: string) => {
      setLoadState('ready');
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        // Continuous in-place video swap (bypasses background autoplay restriction)
        try {
          playerRef.current.loadVideoById(targetVideoId);
        } catch (e) {
          setVideoId(targetVideoId);
        }
      } else {
        setVideoId(targetVideoId);
      }
    };

    // If the track already carries the video ID (from prefetch/props), use it instantly.
    if (currentTrack.youtubeVideoId) {
      playResolvedVideo(currentTrack.youtubeVideoId);
      return;
    }

    // Otherwise ask the backend (which caches in Redis after the first lookup).
    setLoadState('loading');
    fetchVideoId(currentTrack.title, currentTrack.artist)
      .then((id) => {
        if (id) {
          playResolvedVideo(id);
          // Persist the resolved YouTube ID back to the DB so it's cached
          api.post('/telemetry/resolve-video', {
            trackId: currentTrack.id,
            videoId: id,
          }).catch(console.error);
        } else {
          setLoadState('error');
        }
      })
      .catch(() => setLoadState('error'));
  }, [isPlayerOpen, currentTrack]);

  // ── Unified telemetry: fires on EVERY track change or player close ──────────
  // This is the single source of truth for watch telemetry.
  // exitTrackRef holds the track that was playing when the exit happened.
  // skipSourceRef holds how the exit was triggered (set before state changes).
  useEffect(() => {
    // Return a cleanup function that fires when currentTrack changes or player closes
    return () => {
      const track = exitTrackRef.current;
      if (!track) return;

      // Flush any active play segment
      if (playStartTimeRef.current > 0) {
        durationWatchedRef.current += (Date.now() - playStartTimeRef.current) / 1000;
        playStartTimeRef.current = 0;
      }

      const dur = Math.round(durationWatchedRef.current);
      const skipSource   = skipSourceRef.current;
      const isCompleted  = skipSource === null; // null = natural end
      const isUpNext     = skipSource === 'manual' || skipSource === 'auto';

      if (dur >= 1 || isCompleted || isUpNext) {
        api.post('/telemetry/watch', {
          track,
          durationWatched: Math.max(1, dur),
          completed:  isCompleted || isUpNext, // Up Next = intentional = completed
          skipSource,
        }).catch(console.error);
      }

      durationWatchedRef.current = 0;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, isPlayerOpen]);

  // Keep exitTrackRef in sync so the cleanup closure always has the right track
  useEffect(() => {
    if (currentTrack) exitTrackRef.current = currentTrack;
  }, [currentTrack]);

  // Reset state when player fully closes
  useEffect(() => {
    if (!isPlayerOpen) {
      setVideoId(null);
      setLoadState('loading');
      setUpNextTrack(null);
      setUpNextTimer(null);
      hasTriggeredUpNextRef.current = false;
      if (nextTimerRef.current) clearInterval(nextTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }
  }, [isPlayerOpen]);

  // ── Escape key ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlayerOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closePlayer(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [isPlayerOpen, closePlayer]);

  // ── Auto-hide top chrome after 3 s of inactivity ────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowChrome(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowChrome(false), 3000);
  }, []);

  useEffect(() => {
    if (!isPlayerOpen) return;
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, [isPlayerOpen, resetHideTimer]);

  // ── YouTube player options ───────────────────────────────────────────────
  const ytOpts: YouTubeProps['opts'] = {
    width:  '100%',
    height: '100%',
    playerVars: {
      autoplay:       1,
      controls:       1,   // use YouTube's native controls for play/pause/seek/volume
      modestbranding: 1,
      rel:            0,
      iv_load_policy: 3,
      playsinline:    1,
      fs:             1,
    },
  };

  if (!isPlayerOpen || !currentTrack) return null;

  // Natural end: set skipSource=null so the cleanup effect records completed=true
  const handleVideoEnd = () => {
    skipSourceRef.current = null;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (nextTimerRef.current) clearInterval(nextTimerRef.current);
    
    // Video ended -> transition immediately (no 5s pause when music is over)
    triggerUpNext(true);
  };

  const checkProgress = (player: any) => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    
    progressTimerRef.current = setInterval(async () => {
      try {
        const currentTime = await player.getCurrentTime();
        const duration = await player.getDuration();
        
        if (duration > 0 && (duration - currentTime) <= 5 && !hasTriggeredUpNextRef.current) {
           triggerUpNext(false);
        }
      } catch (err) {}
    }, 1000);
  };

  const triggerUpNext = (immediate = false) => {
    if (hasTriggeredUpNextRef.current && !immediate) return;
    hasTriggeredUpNextRef.current = true;

    const playNext = (nextTrack: any, newPlaylist: any[]) => {
      // If video already ended OR user is in a background tab/working in another window:
      // Transition immediately without waiting on a throttled timer.
      if (immediate || document.hidden) {
        if (nextTimerRef.current) clearInterval(nextTimerRef.current);
        skipSourceRef.current = 'auto';
        openPlayer(nextTrack, newPlaylist);
        setUpNextTrack(null);
        setUpNextTimer(null);
        hasTriggeredUpNextRef.current = false;
        return;
      }

      // If user is actively looking at the screen, show the 5s Up Next banner overlay
      setUpNextTrack(nextTrack);
      setUpNextTimer(5);
      
      const endTime = Date.now() + 5000;
      if (nextTimerRef.current) clearInterval(nextTimerRef.current);
      nextTimerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        setUpNextTimer(remaining);
        if (remaining <= 0 || document.hidden) {
          clearInterval(nextTimerRef.current!);
          skipSourceRef.current = 'auto';
          openPlayer(nextTrack, newPlaylist);
          setUpNextTrack(null);
          setUpNextTimer(null);
          hasTriggeredUpNextRef.current = false;
        }
      }, 500);
    };

    // 1. If we already have a prefetched candidate ready, execute instantly
    if (prefetchedNextTrackRef.current) {
      playNext(prefetchedNextTrackRef.current.track, prefetchedNextTrackRef.current.playlist);
      return;
    }

    // 2. Check if there is a next track in the current playlist/album
    const currentIndex = playlist.findIndex((t) => String(t.id) === String(currentTrack!.id));
    if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
      const nextTrackInPlaylist = playlist[currentIndex + 1];
      playNext(nextTrackInPlaylist, playlist);
    } else {
      // 3. Fall back to AI Recommendations
      const excludeIds = Array.from(playedIdsRef.current);
      fetchSimilarTracks(String(currentTrack!.id), currentTrack!.artist, currentTrack!.title, excludeIds).then((recs: any[]) => {
        const nextTrack = recs.find((t: any) => {
          const tId = String(t.id);
          const tNormTitle = normalizeSongTitle(t.title || t.name);
          return !playedIdsRef.current.has(tId) && (!tNormTitle || !playedTitlesRef.current.has(tNormTitle));
        });
        if (nextTrack) {
          playNext(nextTrack, recs);
        } else {
          hasTriggeredUpNextRef.current = false;
        }
      }).catch((err: any) => {
        console.error("Failed to load Up Next from RecEngine:", err);
        hasTriggeredUpNextRef.current = false;
      });
    }
  };

  const cancelUpNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nextTimerRef.current) clearInterval(nextTimerRef.current);
    setUpNextTrack(null);
    setUpNextTimer(null);
  };

  const playUpNext = () => {
    if (nextTimerRef.current) clearInterval(nextTimerRef.current);
    if (upNextTrack) {
      // MANUAL skip: set source BEFORE openPlayer so cleanup effect captures it
      skipSourceRef.current = 'manual';
      openPlayer(upNextTrack, playlist);
      setUpNextTrack(null);
      setUpNextTimer(null);
      hasTriggeredUpNextRef.current = false;
    }
  };

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[300] bg-black flex flex-col select-none"
      onMouseMove={resetHideTimer}
    >
      {/* Top chrome: track info + close/fullscreen buttons */}
      <div
        className={`absolute top-3 left-3 z-20
        transition-all duration-400
        ${showChrome
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-3 pointer-events-none"}`}
      >
        {/* Buttons */}
        {videoId && (
        <button
          id="vp-close"
          onClick={closePlayer}
          className={`w-11 h-11 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-black/70 hover:scale-105 transition-all duration-200`}
          aria-label="Back to Spotiflex"
        >
          <ArrowLeftIcon className="w-6 h-6" />
        </button>
        )}
      </div>

      {/* Video area */}
      <div
        // ref={containerRef}
        className="flex-1 relative flex items-center justify-center bg-black"
      >
        {/* Loading spinner (shown while video ID is being fetched) */}
        {loadState === 'loading' && !videoId && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-white/10 border-t-[#1DB954] rounded-full animate-spin" />
            <p className="text-white/50 text-sm">Finding music video…</p>
          </div>
        )}

        {/* Error */}
        {loadState === 'error' && (
          <div className="flex flex-col items-center gap-4 text-center px-8">
            <span className="text-5xl">🎵</span>
            <p className="text-white font-semibold text-lg">Music video not found</p>
            <p className="text-white/50 text-sm">
              Couldn't find a YouTube video for "{currentTrack.title}" by {currentTrack.artist}.
            </p>
            <button
              onClick={closePlayer}
              className="mt-2 px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* YouTube iframe — fills the whole screen */}
        {videoId && (
          <div className="absolute inset-0 bg-black overflow-hidden">
            <YouTube
              videoId={videoId}
              opts={ytOpts}
              className={`w-full h-full`}
              iframeClassName="w-full h-full"
              onReady={(e: any) => {
                 playerRef.current = e.target;
                 setLoadState('ready');
                 hasTriggeredUpNextRef.current = false;
              }}
              onError={() => setLoadState('error')}
              onStateChange={(e: any) => {
                // e.data === 0 is YT.PlayerState.ENDED
                if (e.data === 0) {
                  handleVideoEnd();
                } else if (e.data === 1) {
                  // PLAYING
                  playStartTimeRef.current = Date.now();
                  checkProgress(e.target);
                } else if (e.data === 2) {
                  // PAUSED
                  if (progressTimerRef.current) clearInterval(progressTimerRef.current);
                  if (playStartTimeRef.current > 0) {
                    durationWatchedRef.current += (Date.now() - playStartTimeRef.current) / 1000;
                    playStartTimeRef.current = 0;
                  }
                }
              }}
              onPlay={(e: any) => { 
                playerRef.current = e.target;
                playStartTimeRef.current = Date.now();
                checkProgress(e.target);
              }}
              onPause={() => {
                if (progressTimerRef.current) clearInterval(progressTimerRef.current);
                if (playStartTimeRef.current > 0) {
                  durationWatchedRef.current += (Date.now() - playStartTimeRef.current) / 1000;
                  playStartTimeRef.current = 0;
                }
              }}
              onEnd={handleVideoEnd}
            />
          </div>
        )}

        {/* Up Next Popup */}
        {upNextTrack && (
          <div className="absolute bottom-8 right-8 z-[400] bg-[#181818]/90 backdrop-blur-md rounded-xl p-4 shadow-2xl flex items-center gap-4 animate-slide-up cursor-pointer hover:bg-[#222] transition-colors border border-white/10" onClick={playUpNext}>
            <button onClick={cancelUpNext} className="absolute -top-3 -right-3 bg-black rounded-full p-1.5 border border-white/20 hover:bg-white/20 z-10 text-white">
              <XMarkIcon className="w-4 h-4" />
            </button>
            <div className="w-24 h-24 shrink-0 rounded overflow-hidden relative">
               <YouTubeImage 
                  src={upNextTrack.coverArtUrl} 
                  alt={upNextTrack.title} 
                  className="w-full h-full object-cover" 
               />
               <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="text-white font-bold text-xl">{upNextTimer}s</span>
               </div>
            </div>
            <div className="flex flex-col max-w-[200px]">
              <span className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Up Next</span>
              <span className="text-white font-bold text-lg leading-tight truncate">{upNextTrack.title}</span>
              <span className="text-[#1DB954] text-sm truncate mt-1">{upNextTrack.artist}</span>
            </div>
          </div>
        )}
      </div>

      {/* Spotiflex watermark
      <div
        className={`absolute bottom-16 left-4 z-10 pointer-events-none
          transition-opacity duration-500 ${showChrome ? 'opacity-40' : 'opacity-0'}`}
      >
        <span
          className="text-[10px] font-black tracking-[0.3em] uppercase"
          style={{
            background: 'linear-gradient(135deg,#1DB954,#00f5a0)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Spotiflex
        </span>
      </div> */}
    </div>
  );
}
