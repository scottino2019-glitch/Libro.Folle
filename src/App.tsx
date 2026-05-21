/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  PenTool,
  Highlighter,
  Eraser,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload,
  Download,
  BookOpen,
  FileCheck,
  Music,
  Info,
  Sparkles,
  HelpCircle,
  X,
  Plus
} from 'lucide-react';
import { DrawingStroke, DrawingTool, AudioTrack, PaperStyle, PageState } from './types';
import PDFViewer from './components/PDFViewer';
import AudioPlayer from './components/AudioPlayer';

export default function App() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [paperStyle, setPaperStyle] = useState<PaperStyle>('lines');
  
  // Audio state
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  
  // Brush/Annotation controls
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [brushColor, setBrushColor] = useState<string>('#1c1917'); // Stone 900
  const [brushWidth, setBrushWidth] = useState<number>(3);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  
  // Custom non-blocking confirmations and toast feedback
  const [isConfirmingClearPage, setIsConfirmingClearPage] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Play a friendly soft high-contrast confirmation tick sound contextually!
    try {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.setValueAtTime(type === 'success' ? 880 : 330, audioContext.currentTime);
      gain.gain.setValueAtTime(0.05, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
      osc.start();
      osc.stop(audioContext.currentTime + 0.15);
    } catch (_) {}
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);
  
  // Master drawings dictionary: Record<pageNumber_key, PageState>
  const [annotations, setAnnotations] = useState<Record<number, PageState>>({});
  
  // Modal toggle
  const [showInfo, setShowInfo] = useState<boolean>(true);

  // Auto-load sketches from LocalStorage depending on what PDF is opened
  const storageKey = pdfName 
    ? `pdf-notebook-drawings-${pdfName}` 
    : 'pdf-notebook-drawings-empty-ledger';

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setAnnotations(JSON.parse(saved));
      } else {
        setAnnotations({});
      }
    } catch (err) {
      console.warn('Impossibile caricare le annotazioni salvate:', err);
    }
  }, [storageKey]);

  // Persist drawings dictionary on change
  const saveAnnotations = (updated: Record<number, PageState>) => {
    setAnnotations(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (err) {
      console.warn('Salvataggio annotazioni fallito:', err);
    }
  };

  const activePageState: PageState = annotations[pageNumber] || { strokes: [], redoStack: [] };

  const handleAddStroke = (newStroke: DrawingStroke) => {
    const updatedState: PageState = {
      strokes: [...activePageState.strokes, newStroke],
      redoStack: [] // Clear redo stack on new action
    };
    
    const updatedAnnotations = {
      ...annotations,
      [pageNumber]: updatedState
    };
    
    saveAnnotations(updatedAnnotations);
  };

  const handleUndo = () => {
    if (activePageState.strokes.length === 0) return;
    
    const popStroke = activePageState.strokes[activePageState.strokes.length - 1];
    const updatedState: PageState = {
      strokes: activePageState.strokes.slice(0, -1),
      redoStack: [...activePageState.redoStack, popStroke]
    };
    
    const updatedAnnotations = {
      ...annotations,
      [pageNumber]: updatedState
    };
    
    saveAnnotations(updatedAnnotations);
  };

  const handleRedo = () => {
    if (activePageState.redoStack.length === 0) return;
    
    const restoreStroke = activePageState.redoStack[activePageState.redoStack.length - 1];
    const updatedState: PageState = {
      strokes: [...activePageState.strokes, restoreStroke],
      redoStack: activePageState.redoStack.slice(0, -1)
    };
    
    const updatedAnnotations = {
      ...annotations,
      [pageNumber]: updatedState
    };
    
    saveAnnotations(updatedAnnotations);
  };

  const handleClearPage = () => {
    const updatedState: PageState = {
      strokes: [],
      redoStack: []
    };
    
    const updatedAnnotations = {
      ...annotations,
      [pageNumber]: updatedState
    };
    
    saveAnnotations(updatedAnnotations);
    setIsConfirmingClearPage(false);
    showToast('Disegni pagina ripuliti!');
  };

  const handleAddBlankPage = () => {
    if (pdfUrl) return; // Locked to real pdf page layout in PDF mode
    setTotalPages((prev) => prev + 1);
    setPageNumber(totalPages + 1);
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size & set name
    setPdfName(file.name);
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    
    // Clear state or wait for useEffect storage sync to pop
  };

  const handleAddTracks = (newTracks: AudioTrack[]) => {
    setTracks((prev) => [...prev, ...newTracks]);
  };

  const handleRemoveTrack = (id: string) => {
    // Revoke object URL to prevent memory leaks
    const track = tracks.find((t) => t.id === id);
    if (track) {
      URL.revokeObjectURL(track.url);
    }
    setTracks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleClearTracks = () => {
    tracks.forEach((t) => URL.revokeObjectURL(t.url));
    setTracks([]);
    showToast('Playlist ripulita!');
  };

  // WAV Generator helper for pristine sample files
  const createSampleWavBlob = () => {
    const sampleRate = 8000;
    const duration = 2; // 2 seconds
    const numFrames = sampleRate * duration;
    const buffer = new ArrayBuffer(44 + numFrames * 2);
    const view = new DataView(buffer);

    const writeString = (v: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        v.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numFrames * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // Raw PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true); // Sample rate
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, numFrames * 2, true);

    let offset = 44;
    for (let i = 0; i < numFrames; i++) {
      const t = i / sampleRate;
      
      // Multi-sine chime synth logic
      const envelope = Math.sin(Math.PI * (t / duration)); // fade-in fade-out envelope
      const f1 = 440; // Pitch A4
      const f2 = 554; // Pitch C#5
      const note = Math.sin(2 * Math.PI * f1 * t) * 0.4 + Math.sin(2 * Math.PI * f2 * t) * 0.25;
      const vibrato = Math.sin(2 * Math.PI * 4 * t) * 0.05; // 4Hz vibrato
      
      const sample = note * (1 + vibrato) * envelope;
      view.setInt16(offset, sample * 32767, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  // Inserts sample assets automatically for evaluation testing
  const loadDemoSandbox = () => {
    // 1. Generate local PCM WAV for testing
    const wavBlob = createSampleWavBlob();
    const mockTrackUrl = URL.createObjectURL(wavBlob);
    
    const demoTrack: AudioTrack = {
      id: 'demo-track-chime',
      name: 'Esercizio Audio Esempio (Local Synth)',
      url: mockTrackUrl,
      size: '32 KB'
    };
    
    setTracks([demoTrack]);
    
    // 2. Set style to lined notebook
    setPaperStyle('lines');
    setTotalPages(3);
    setPageNumber(1);
    setPdfUrl(null);
    setPdfName(null);

    // Pre-populate gorgeous demo doodles
    setAnnotations({
      1: {
        strokes: [
          {
            points: [{ x: 100, y: 150 }, { x: 125, y: 152 }, { x: 155, y: 160 }, { x: 195, y: 145 }, { x: 225, y: 135 }, { x: 260, y: 155 }],
            color: '#FF4D00',
            width: 5,
            tool: 'pen'
          },
          {
            points: [{ x: 140, y: 220 }, { x: 210, y: 220 }, { x: 290, y: 225 }],
            color: '#FFD700',
            width: 14,
            tool: 'highlighter'
          }
        ],
        redoStack: []
      }
    });
    
    // 3. Close guide sheet
    setShowInfo(false);
    showToast('Demo Esempio Caricato!');
  };

  // Export current drawings and study sketches as a portable portable backup JSON file
  const exportStudyBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(annotations, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `notebook-backup-${pdfName || 'ledger'}-${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Restore portable JSON backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && typeof parsed === 'object') {
          saveAnnotations(parsed);
          showToast('Backup ripristinato!', 'success');
        } else {
          showToast('Formato non valido!', 'error');
        }
      } catch (err) {
        showToast('Errore di caricamento.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1A1A1A] flex flex-col font-sans selection:bg-[#FFD700] selection:text-[#1A1A1A] leading-tight border-[8px] md:border-[12px] border-[#1A1A1A]">
      
      {/* Pristine Minimal Header bar in Artistic Style */}
      <header className="bg-white border-b-4 border-[#1A1A1A] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#FF4D00] rounded-full border-2 border-[#1A1A1A] flex items-center justify-center font-bold text-white shadow-[2px_2px_0px_rgba(26,26,26,1)]">
            ★
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tighter text-[#1A1A1A]">
              Libro.Folle v.1.0
            </h1>
            <p className="text-[10px] text-[#1A1A1A] uppercase tracking-wider font-bold opacity-60">
              PDF STUDY &amp; NOTEBOOK WITH BACKING AUDIO
            </p>
          </div>
        </div>

        {/* Global Loading / Reset actions with neo-brutalist custom styling */}
        <div className="flex items-center gap-3">
          {/* Real local PDF uploader */}
          <label 
            htmlFor="pdf-file-selector"
            className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-[#1A1A1A] hover:bg-[#FF4D00] hover:text-white text-[#1A1A1A] text-xs font-black uppercase tracking-tight cursor-pointer shadow-[3px_3px_0px_#1A1A1A] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-95 select-none"
          >
            <Upload className="w-3.5 h-3.5" />
            Carica PDF
          </label>
          <input 
            id="pdf-file-selector"
            type="file" 
            accept="application/pdf" 
            className="hidden" 
            onChange={handlePdfUpload} 
          />

          <button
            onClick={() => setShowInfo(true)}
            className="h-10 w-10 border-2 border-[#1A1A1A] flex items-center justify-center font-bold hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer text-[#1A1A1A] bg-white text-sm"
            title="Mostra Istruzioni"
          >
            ?
          </button>

          <button
            id="btn-sandbox-starter"
            onClick={loadDemoSandbox}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#FFD700] border-2 border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] text-xs font-black uppercase tracking-tight cursor-pointer shadow-[3px_3px_0px_#1A1A1A] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-95"
            title="Attiva quaderno interattivo con traccia di prova integrata"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Prova Esempio
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col lg:flex-row items-stretch overflow-hidden">
        
        {/* LEFT FLOATING BAR: Drawing Instruments */}
        <div className="w-full lg:w-72 bg-white border-r-2 lg:border-b-0 border-b-2 border-[#1A1A1A] p-5 flex flex-col gap-5 overflow-y-auto shrink-0 select-none">
          
          {/* Active PDF banner indicator */}
          <div className="bg-[#E8F0FE] border-2 border-[#1A1A1A] p-3 rounded-lg flex items-center justify-between shadow-[3px_3px_0px_#1A1A1A]">
            <div className="overflow-hidden pr-2 flex-1">
              <span className="text-[9px] text-[#1A1A1A] uppercase font-mono font-black tracking-widest block opacity-55">
                Sorgente Documento
              </span>
              <p className="text-xs font-black text-[#1A1A1A] truncate" title={pdfName || "Quaderno di Appunti"}>
                {pdfName ? pdfName : "Quaderno di Appunti"}
              </p>
            </div>
            {pdfName && (
              <button 
                onClick={() => {
                  setPdfUrl(null);
                  setPdfName(null);
                  setTotalPages(3);
                  setPageNumber(1);
                  setPaperStyle('lines');
                }}
                className="p-1 text-[#1A1A1A] hover:text-[#FF4D00] border border-transparent hover:border-[#1A1A1A] rounded-md transition" 
                title="Rimuovi PDF"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Core Tools Section */}
          <section className="flex flex-col gap-2.5">
            <h3 className="text-[10px] font-black text-[#1A1A1A] opacity-40 uppercase tracking-widest font-mono">
              Strumenti Scrittura
            </h3>
            <div className="grid grid-cols-3 gap-1.5 bg-[#F7F5F0] border-2 border-[#1A1A1A] p-1 rounded-xl">
              <button
                id="tool-pen"
                onClick={() => { setTool('pen'); setIsPanning(false); }}
                className={`py-2 px-1 rounded-lg flex flex-col items-center justify-center gap-1 transition-all uppercase tracking-tighter border-2 ${
                  tool === 'pen' && !isPanning
                    ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-xs'
                    : 'bg-white text-[#1A1A1A] border-transparent hover:border-[#1A1A1A]/30'
                }`}
                title="Penna di precisione per prendere appunti"
              >
                <PenTool className="w-4 h-4" />
                <span className="text-[9px] font-black">Penna</span>
              </button>
              
              <button
                id="tool-highlighter"
                onClick={() => { setTool('highlighter'); setIsPanning(false); }}
                className={`py-2 px-1 rounded-lg flex flex-col items-center justify-center gap-1 transition-all uppercase tracking-tighter border-2 ${
                  tool === 'highlighter' && !isPanning
                    ? 'bg-[#FFD700] text-[#1A1A1A] border-[#1A1A1A] shadow-xs'
                    : 'bg-white text-[#1A1A1A] border-transparent hover:border-[#1A1A1A]/30'
                }`}
                title="Evidenziatore traslucido per evidenziare testi"
              >
                <Highlighter className="w-4 h-4" />
                <span className="text-[9px] font-black">Evidenziatore</span>
              </button>
              
              <button
                id="tool-eraser"
                onClick={() => { setTool('eraser'); setIsPanning(false); }}
                className={`py-2 px-1 rounded-lg flex flex-col items-center justify-center gap-1 transition-all uppercase tracking-tighter border-2 ${
                  tool === 'eraser' && !isPanning
                    ? 'bg-[#FF4D00] text-white border-[#1A1A1A] shadow-xs'
                    : 'bg-white text-[#1A1A1A] border-transparent hover:border-[#1A1A1A]/30'
                }`}
                title="Gomma a tratto"
              >
                <Eraser className="w-4 h-4" />
                <span className="text-[9px] font-black">Gomma</span>
              </button>
            </div>
          </section>

          {/* Color Selection Block */}
          {tool !== 'eraser' && (
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-black text-[#1A1A1A] opacity-40 uppercase tracking-widest font-mono">
                Colore Tratto
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { hex: '#1c1917', label: 'Carbon' },
                  { hex: '#1d4ed8', label: 'Navy' },
                  { hex: '#dc2626', label: 'Crimson' },
                  { hex: '#15803d', label: 'Emerald' },
                  { hex: '#eab308', label: 'Amber' },
                  { hex: '#ca8a04', label: 'Yellow' }
                ].map((colorObj) => {
                  const finalColor = tool === 'highlighter' 
                    ? `${colorObj.hex}44` // semi-transparent highlighter!
                    : colorObj.hex;
                  
                  const isSelected = tool === 'highlighter' 
                    ? brushColor.slice(0, 7) === colorObj.hex 
                    : brushColor === colorObj.hex;

                  return (
                    <button
                      key={colorObj.hex}
                      onClick={() => setBrushColor(finalColor)}
                      className={`w-8 h-8 rounded-full relative cursor-pointer active:scale-95 transition-all border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]`}
                      style={{ backgroundColor: colorObj.hex }}
                      title={colorObj.label}
                    >
                      {isSelected && (
                        <span className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-white ring-2 ring-[#1A1A1A]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Stroke Width Slider */}
          <section className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-[#1A1A1A] opacity-40 uppercase tracking-widest font-mono">
                Spessore Tratto
              </span>
              <span className="font-mono text-xs text-[#1A1A1A] font-black">{brushWidth}px</span>
            </div>
            <div className="flex items-center gap-3 bg-[#F7F5F0] border-2 border-[#1A1A1A] p-3 rounded-lg">
              <input
                id="brush-width-slider"
                type="range"
                min={tool === 'eraser' ? 5 : 1}
                max={tool === 'eraser' ? 35 : 18}
                value={brushWidth}
                onChange={(e) => setBrushWidth(parseInt(e.target.value))}
                className="w-full h-1.5 bg-[#1A1A1A]/20 rounded-lg appearance-none cursor-pointer accent-[#1A1A1A]"
              />
              <div 
                className="w-6 h-6 flex items-center justify-center shrink-0 border-2 border-[#1A1A1A] bg-white rounded-md shadow-[1px_1px_0px_#1A1A1A]"
                title="Anteprima grandezza"
              >
                <div 
                  className="rounded-full bg-[#1A1A1A]"
                  style={{ 
                    width: `${Math.max(2, Math.min(18, brushWidth))}px`, 
                    height: `${Math.max(2, Math.min(18, brushWidth))}px` 
                  }}
                />
              </div>
            </div>
          </section>

          {/* Page History Controls */}
          <section className="flex flex-col gap-2 border-t-2 border-[#1A1A1A] pt-4 mt-1">
            <span className="text-[10px] font-black text-[#1A1A1A] opacity-40 uppercase tracking-widest font-mono">
              Azioni Pagina
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-undo"
                disabled={activePageState.strokes.length === 0}
                onClick={handleUndo}
                className="flex items-center justify-center gap-1 py-1.5 px-2 border-2 border-[#1A1A1A] bg-white hover:bg-[#1A1A1A] hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-[#1A1A1A] text-[#1A1A1A] text-xs font-black uppercase rounded-lg cursor-pointer transition-all shadow-[2px_2px_0px_#1A1A1A] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none"
                title="Annulla ultimo tratto (Undo)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo
              </button>
              
              <button
                id="btn-redo"
                disabled={activePageState.redoStack.length === 0}
                onClick={handleRedo}
                className="flex items-center justify-center gap-1 py-1.5 px-2 border-2 border-[#1A1A1A] bg-white hover:bg-[#1A1A1A] hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-[#1A1A1A] text-[#1A1A1A] text-xs font-black uppercase rounded-lg cursor-pointer transition-all shadow-[2px_2px_0px_#1A1A1A] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none"
                title="Ripristina tratto annullato (Redo)"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Redo
              </button>
            </div>

            {isConfirmingClearPage ? (
              <div className="flex gap-2 w-full mt-1.5">
                <button
                  onClick={handleClearPage}
                  className="flex-1 py-1.5 bg-red-500 hover:bg-red-650 text-white border-2 border-[#1A1A1A] text-[10px] font-black uppercase tracking-tight rounded-lg transition-all cursor-pointer shadow-[2px_2px_0px_#1A1A1A]"
                  title="Elimina tutti i disegni definitivamente"
                >
                  Sì, Cancella!
                </button>
                <button
                  onClick={() => setIsConfirmingClearPage(false)}
                  className="px-3 py-1.5 bg-white text-[#1A1A1A] border-2 border-[#1A1A1A] text-[10px] font-black uppercase tracking-tight rounded-lg transition-all cursor-pointer shadow-[2px_2px_0px_#1A1A1A]"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                id="btn-clear-canvas"
                disabled={activePageState.strokes.length === 0}
                onClick={() => setIsConfirmingClearPage(true)}
                className="flex items-center justify-center gap-1.5 w-full mt-1.5 py-1.5 bg-white hover:bg-red-500 hover:text-white text-red-500 border-2 border-red-500 text-xs font-black uppercase tracking-tight rounded-lg transition-all cursor-pointer shadow-[2px_2px_0px_rgba(239,68,68,0.3)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none disabled:opacity-35"
                title="Svuota completamente tutti i disegni della pagina attiva"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Pulisci Pagina
              </button>
            )}
          </section>

          {/* Import/Export Backup Utilities */}
          <section className="flex flex-col gap-2 border-t-2 border-[#1A1A1A] pt-4 mt-auto">
            <span className="text-[10px] font-black text-[#1A1A1A] opacity-40 uppercase tracking-widest font-mono">
              Salvataggi e Backup
            </span>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={exportStudyBackup}
                className="flex items-center justify-center gap-1.5 py-2 border-2 border-[#1A1A1A] bg-white hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] text-xs font-black uppercase rounded-lg transition-all shadow-[2px_2px_0px_#1A1A1A] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none cursor-pointer"
                title="Salva le note scritte in un file JSON di backup"
              >
                <Download className="w-3.5 h-3.5" />
                Esporta Backup
              </button>
              
              <label
                htmlFor="import-backup-file"
                className="flex items-center justify-center gap-1.5 py-2 border-2 border-[#1A1A1A] bg-[#F7F5F0] hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] text-xs font-[#1A1A1A] font-black uppercase rounded-lg transition-all shadow-[2px_2px_0px_#1A1A1A] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none text-center cursor-pointer"
                title="Ripristina note da un file JSON salvato precedentemente"
              >
                <Upload className="w-3.5 h-3.5" />
                Importa Backup
              </label>
              <input
                id="import-backup-file"
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportBackup}
              />
            </div>
          </section>

        </div>

        {/* CENTER PANE: Dynamic PDF Stage workspace */}
        <div className="flex-1 bg-[#D9D9D9] p-6 flex flex-col items-center overflow-y-auto min-h-0 relative">
          <PDFViewer
            pdfUrl={pdfUrl}
            pageNumber={pageNumber}
            setPageNumber={setPageNumber}
            totalPages={totalPages}
            setTotalPages={setTotalPages}
            
            strokes={activePageState.strokes}
            onAddStroke={handleAddStroke}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClearPage}
            canUndo={activePageState.strokes.length > 0}
            canRedo={activePageState.redoStack.length > 0}
            
            tool={tool}
            color={brushColor}
            strokeWidth={brushWidth}
            paperStyle={paperStyle}
            setPaperStyle={setPaperStyle}
            isPanning={isPanning}
            onAddBlankPage={handleAddBlankPage}
          />
        </div>

        {/* RIGHT PANEL: Slick Cassette Audio Player */}
        <div className="w-full lg:w-80 bg-white border-l-2 lg:border-[#1A1A1A] lg:border-t-0 border-t-2 border-[#1A1A1A] p-5 shrink-0 flex flex-col overflow-hidden">
          <AudioPlayer
            tracks={tracks}
            onAddTracks={handleAddTracks}
            onRemoveTrack={handleRemoveTrack}
            onClearTracks={handleClearTracks}
          />
        </div>

      </div>

      {/* Floating Interactive Guide overlay sheet styled in Gorgeous Artistic Neo-Brutalist Frame */}
      {showInfo && (
        <div className="fixed inset-0 bg-[#1A1A1A]/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#F7F5F0] border-4 border-[#1A1A1A] rounded-none max-w-lg w-full p-6 shadow-[12px_12px_0px_rgba(0,0,0,1)] relative">
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-4 right-4 p-1.5 border-2 border-[#1A1A1A] bg-white hover:bg-[#FF4D00] hover:text-white transition-colors cursor-pointer text-[#1A1A1A]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-4 h-4 bg-[#FF4D00]" />
              <h2 className="font-sans font-black text-[#1A1A1A] uppercase tracking-tighter text-lg">
                Benvenuto in Libro.Folle!
              </h2>
            </div>

            <div className="space-y-3 text-[#1A1A1A] text-xs leading-relaxed font-bold">
              <p>
                Un lettore PDF interattivo e quaderno intelligente ad alto contrasto per annotare, evidenziare e ascoltare esercizi audio simultaneamente e in background!
              </p>
              
              <div className="p-4 bg-white border-2 border-[#1A1A1A] space-y-3 shadow-[4px_4px_0px_#1A1A1A]">
                <div className="flex items-start gap-2">
                  <span className="text-[#FF4D00] font-black font-mono">01.</span>
                  <span><strong>Carica PDF:</strong> Carica un file PDF per studiare e prendere appunti direttamente sopra le sue pagine.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#FF4D00] font-black font-mono">02.</span>
                  <span><strong>Stile Carta:</strong> Cambia rapidamente lo stile della carta tra Quadretti, Righe per quaderni e Blank di sfondo.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#FF4D00] font-black font-mono">03.</span>
                  <span><strong>Cassetta Esercizi:</strong> Trascina file audio (.mp3, .wav) o usa il pulsante &quot;Prova Esempio&quot; per iniziare con una traccia campione.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#FF4D00] font-black font-mono">04.</span>
                  <span><strong>Pratiche Evidenziazioni &amp; Tratti:</strong> Sfrutta l&apos;evidenziatore e i tratti a moltiplicazione di colore per una scrittura fluida.</span>
                </div>
              </div>

              <p className="text-[10px] text-[#1A1A1A]/70 uppercase font-mono tracking-wide">
                TI MANCANO FILES? CLICCA SU &quot;PROVA ESEMPIO&quot; PER CARICARE IL DEMO INTERATTIVO IMMEDIATO!
              </p>
            </div>

            <div className="mt-6 pt-4 border-t-2 border-[#1A1A1A] flex justify-end gap-3">
              <button
                onClick={loadDemoSandbox}
                className="px-4 py-2 bg-[#FFD700] border-2 border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] text-xs font-black uppercase tracking-tight shadow-[3px_3px_0px_#1A1A1A] transition-all"
              >
                Prova Esempio
              </button>
              <button
                onClick={() => setShowInfo(false)}
                className="px-5 py-2 bg-[#1A1A1A] text-white text-xs font-black uppercase tracking-tight hover:bg-[#FF4D00] transition-colors"
              >
                Inizia ora
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-20 right-6 z-[60] flex items-center gap-3 px-5 py-3 bg-white border-4 border-[#1A1A1A] font-black text-xs uppercase shadow-[6px_6px_0px_rgba(26,26,26,1)] select-none">
          <div className={`w-3.5 h-3.5 rounded-full ${toastType === 'success' ? 'bg-emerald-500 animate-ping' : 'bg-[#FF4D00]'} border-2 border-[#1A1A1A]`} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Footer layout indicator */}
      <footer className="h-12 bg-[#1A1A1A] text-white flex items-center px-8 justify-between text-[10px] font-mono tracking-widest uppercase select-none">
        <span>PDF_ENGINE_V2.0</span>
        <span className="flex items-center gap-2">
          <FileCheck className="w-3.5 h-3.5 text-[#FFD700]" />
          DATI SALVATI LOCALE SUL BROWSER
        </span>
      </footer>
    </div>
  );
}
