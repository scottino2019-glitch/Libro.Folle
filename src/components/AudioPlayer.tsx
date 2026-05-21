/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, FolderOpen, SkipBack, SkipForward, Volume2, Music, Trash2, Gauge, Clock } from 'lucide-react';
import { AudioTrack } from '../types';

interface AudioPlayerProps {
  tracks: AudioTrack[];
  onAddTracks: (newTracks: AudioTrack[]) => void;
  onRemoveTrack: (id: string) => void;
  onClearTracks: () => void;
}

export default function AudioPlayer({ tracks, onAddTracks, onRemoveTrack, onClearTracks }: AudioPlayerProps) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [confirmClear, setConfirmClear] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null;

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Sync index if track list becomes empty
  useEffect(() => {
    if (tracks.length === 0) {
      setCurrentTrackIndex(-1);
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    } else if (currentTrackIndex >= tracks.length) {
      setCurrentTrackIndex(tracks.length - 1);
    }
  }, [tracks, currentTrackIndex]);

  // Handle active track change
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;

    if (currentTrack) {
      const wasPlaying = isPlaying;
      audio.src = currentTrack.url;
      audio.load();
      audio.playbackRate = playbackRate;
      audio.volume = volume;

      const handleLoadedMetadata = () => {
        setDuration(audio.duration || 0);
      };

      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
      };

      const handleEnded = () => {
        // Auto play next track if available
        if (currentTrackIndex + 1 < tracks.length) {
          setCurrentTrackIndex(currentTrackIndex + 1);
        } else {
          setIsPlaying(false);
          setCurrentTime(0);
        }
      };

      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);

      if (wasPlaying) {
        audio.play().catch((err) => {
          console.warn('Playback failed:', err);
          setIsPlaying(false);
        });
      }

      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
      };
    } else {
      audio.pause();
      audio.src = '';
      setCurrentTime(0);
      setDuration(0);
    }
  }, [currentTrackIndex]);

  // Sync play/pause state
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;
    
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Sync playback speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newTracks: AudioTrack[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Format file size
      const sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      const url = URL.createObjectURL(file);
      
      newTracks.push({
        id: `track-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        name: file.name.replace(/\.[^/.]+$/, ""), // remove extension
        url: url,
        size: sizeStr,
      });
    }

    onAddTracks(newTracks);

    // If no active track, select the first newly added track
    if (currentTrackIndex === -1) {
      setCurrentTrackIndex(tracks.length);
    }

    // Reset file input value so same files can be reuploaded
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const togglePlay = () => {
    if (tracks.length === 0) return;
    if (currentTrackIndex === -1) {
      setCurrentTrackIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const skipTime = (amount: number) => {
    if (!audioRef.current || !currentTrack) return;
    let newTime = audioRef.current.currentTime + amount;
    if (newTime < 0) newTime = 0;
    if (newTime > duration) newTime = duration;
    
    setCurrentTime(newTime);
    audioRef.current.currentTime = newTime;
  };

  const formatTime = (timeInSecs: number) => {
    if (isNaN(timeInSecs)) return '0:00';
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex flex-col bg-[#F7F5F0] border-4 border-[#1A1A1A] shadow-[6px_6px_0px_#1A1A1A] overflow-hidden h-full">
      {/* Mini Cassette Tape UI/Header in Neo-Brutalist Frame */}
      <div className="p-4 bg-white border-b-[#1A1A1A] border-b-4">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-[#FF4D00] animate-pulse" />
            <h3 className="font-sans font-black uppercase text-xs tracking-wider text-[#1A1A1A]">
              Esercizi Audio
            </h3>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-3 py-1.5 bg-white border-2 border-[#1A1A1A] hover:bg-[#FFD700] text-[#1A1A1A] rounded-md text-xs font-black uppercase tracking-tight cursor-pointer transition-all shadow-[2px_2px_0px_#1A1A1A] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none"
          >
            + Audio
          </button>
          <input
            id="audio-file-uploader"
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Cassette Retro Display - Solid dark contrast */}
        <div className="relative bg-zinc-950 text-white rounded-none p-3.5 font-mono text-center flex flex-col justify-center items-center h-28 border-2 border-[#1A1A1A] shadow-inner overflow-hidden">
          {/* Subtle design scanlines */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-gradient-to-b from-[#FF4D00]/20 via-transparent to-black" />
          
          <div className="relative w-full z-10">
            {currentTrack ? (
              <>
                <div className="text-[10px] text-[#FF4D00] tracking-widest uppercase mb-1 truncate px-2 font-black">
                  ◆ PLAYING ◆
                </div>
                <div className="text-sm text-yellow-500/90 font-bold truncate px-1 max-w-full">
                  {currentTrack.name}
                </div>
                <div className="flex items-center justify-center gap-4 mt-2">
                  <div className="text-[11px] flex items-center gap-1 text-zinc-300 font-mono">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-zinc-600">/</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <div className="text-[11px] flex items-center gap-1 text-[#FFD700] font-mono font-bold">
                    <Gauge className="w-3 h-3 text-zinc-500" />
                    <span>{playbackRate.toFixed(2)}x</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-400 py-2">
                <p className="text-xs font-bold uppercase tracking-tight text-[#FFD700] mb-1">Cassette Deck Empty</p>
                <p className="text-[9px] text-zinc-500 max-w-[200px] leading-relaxed font-bold">
                  CARICA ESERCIZI AUDIO MP3/WAV E RIPRODUCILI MENTRE STUDI IL PDF SULLO SCHERMO
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Speed, Time bar & Player controls */}
      {currentTrack && (
        <div className="p-4 border-b border-stone-200 bg-white">
          {/* Audio progress slider */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-mono text-stone-500 select-none w-8 text-right font-black">
              {formatTime(currentTime)}
            </span>
            <input
              id="audio-seek-slider"
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-700"
            />
            <span className="text-[11px] font-mono text-stone-500 select-none w-8 text-left font-black">
              {formatTime(duration)}
            </span>
          </div>

          {/* Player Main Controls Grid */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center gap-2.5">
              {/* Skip back 5s */}
              <button
                id="btn-skip-backward"
                onClick={() => skipTime(-5)}
                className="p-1.5 border-2 border-[#1A1A1A] bg-white hover:bg-stone-100 text-[#1A1A1A] rounded-lg transition-colors shadow-[2px_2px_0px_#1A1A1A] cursor-pointer"
                title="Indietro di 5 secondi"
              >
                <SkipBack className="w-4 h-4" />
                <span className="sr-only">Indietro 5s</span>
              </button>

              {/* Play / Pause button with visual circle */}
              <button
                id="btn-play-pause"
                onClick={togglePlay}
                className="p-3 bg-[#FF4D00] text-white border-2 border-[#1A1A1A] rounded-full transition-all shadow-[3px_3px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer hover:bg-[#FF4D00]/95"
                title={isPlaying ? "Pausa" : "Riproduci"}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>

              {/* Skip forward 5s */}
              <button
                id="btn-skip-forward"
                onClick={() => skipTime(5)}
                className="p-1.5 border-2 border-[#1A1A1A] bg-white hover:bg-stone-100 text-[#1A1A1A] rounded-lg transition-colors shadow-[2px_2px_0px_#1A1A1A] cursor-pointer"
                title="Avanti di 5 secondi"
              >
                <SkipForward className="w-4 h-4" />
                <span className="sr-only">Avanti 5s</span>
              </button>
            </div>

            {/* Speeds and volume line */}
            <div className="flex items-center justify-between gap-4 pt-1">
              {/* Speed controls */}
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg border-2 border-[#1A1A1A]">
                <span className="text-[10px] font-black text-[#1A1A1A] uppercase px-1 pb-0.5 select-none font-mono">
                  Rate
                </span>
                {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setPlaybackRate(rate)}
                    className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded transition-all ${
                      playbackRate === rate
                        ? 'bg-[#1A1A1A] text-white shadow-xs'
                        : 'text-stone-600 hover:bg-[#F7F5F0]'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-1.5 flex-1 max-w-[100px]">
                <Volume2 className="w-3.5 h-3.5 text-[#1A1A1A]" />
                <input
                  id="volume-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#1A1A1A]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tracks Playlist Area */}
      <div className="flex-1 overflow-y-auto px-1 py-2 min-h-[140px]">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-stone-400 py-8 text-center px-4 self-center my-auto">
            <div className="p-3 border-2 border-dashed border-[#1A1A1A]/30 rounded-full mb-2 bg-white">
              <Music className="w-5 h-5 text-stone-400" />
            </div>
            <p className="text-xs font-black text-[#1A1A1A]">Lista tracce vuota</p>
            <p className="text-[10px] text-stone-500 mt-1 uppercase tracking-widest font-mono font-bold">Carica file .mp3 o .wav</p>
          </div>
        ) : (
          <div className="space-y-1 px-2">
            <div className="flex items-center justify-between px-1 mb-1 text-[11px] text-[#1A1A1A]/60 font-black uppercase font-mono tracking-wider">
              <span>Traccia</span>
              {confirmClear ? (
                <div className="flex items-center gap-1.5 text-[9px] font-bold">
                  <span className="text-red-500">Sicuro?</span>
                  <button
                    onClick={() => {
                      onClearTracks();
                      setConfirmClear(false);
                    }}
                    className="text-red-600 hover:underline cursor-pointer uppercase"
                  >
                    Sì
                  </button>
                  <span className="text-[#1A1A1A]/30">|</span>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="text-stone-500 hover:underline cursor-pointer uppercase"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="hover:text-red-500 transition-colors flex items-center gap-0.5 underline cursor-pointer"
                  title="Pulisci tutto"
                >
                  Pulisci playlist
                </button>
              )}
            </div>
            {tracks.map((track, idx) => (
              <div
                key={track.id}
                onClick={() => setCurrentTrackIndex(idx)}
                className={`group flex items-center justify-between p-2 rounded-xl text-left cursor-pointer transition-all border-2 ${
                  idx === currentTrackIndex
                    ? 'bg-[#E8F0FE] border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                    : 'bg-white hover:bg-stone-50/70 border-[#1A1A1A]/20'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-white border-2 border-[#1A1A1A] text-[10px] font-mono font-black text-[#1A1A1A]">
                    {idx + 1}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className={`text-xs font-bold truncate ${idx === currentTrackIndex ? 'text-black' : 'text-stone-700'}`}>
                      {track.name}
                    </p>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {track.size || 'Auto size'}
                    </span>
                  </div>
                </div>
                
                <button
                  id={`btn-remove-track-${track.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // If playing the removed track, stop playback
                    if (idx === currentTrackIndex) {
                      setIsPlaying(false);
                      setCurrentTrackIndex(-1);
                    } else if (idx < currentTrackIndex) {
                      setCurrentTrackIndex(currentTrackIndex - 1);
                    }
                    onRemoveTrack(track.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 rounded-md transition-all ml-1 resize-none"
                  title="Elimina traccia"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
