/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Plus, Minus, ZoomIn, ZoomOut, FileText, Check } from 'lucide-react';
import { usePdfJs } from '../hooks/usePdfJs';
import DrawingCanvas from './DrawingCanvas';
import { DrawingStroke, DrawingTool, PaperStyle } from '../types';

interface PDFViewerProps {
  pdfUrl: string | null;
  pageNumber: number;
  setPageNumber: (num: number) => void;
  totalPages: number;
  setTotalPages: (num: number) => void;
  
  strokes: DrawingStroke[];
  onAddStroke: (stroke: DrawingStroke) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  
  tool: DrawingTool;
  color: string;
  strokeWidth: number;
  
  paperStyle: PaperStyle;
  setPaperStyle: (style: PaperStyle) => void;
  isPanning: boolean;
  onAddBlankPage: () => void;
}

export default function PDFViewer({
  pdfUrl,
  pageNumber,
  setPageNumber,
  totalPages,
  setTotalPages,
  strokes,
  onAddStroke,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  tool,
  color,
  strokeWidth,
  paperStyle,
  setPaperStyle,
  isPanning,
  onAddBlankPage,
}: PDFViewerProps) {
  const { loaded: pdfJsLoaded, error: pdfJsError } = usePdfJs();
  
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1.2); // Scaling factor
  
  const [dimensions, setDimensions] = useState({ width: 680, height: 880 });
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initialize PDF doc when URL changes
  useEffect(() => {
    if (!pdfJsLoaded || !pdfUrl) {
      setPdfDoc(null);
      if (pdfUrl === null && totalPages > 100) {
        // cap standard binder templates
        setTotalPages(3);
      }
      return;
    }

    const loadPdf = async () => {
      setLoading(true);
      try {
        const pdfjsLib = (window as any).pdfjsLib;
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setPageNumber(1);
        setPaperStyle('pdf');
      } catch (err) {
        console.error('Errore durante il caricamento del PDF:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [pdfUrl, pdfJsLoaded]);

  // Handle PDF Page rendering
  useEffect(() => {
    if (!pdfDoc || !pdfJsLoaded) {
      // No PDF loaded, set standard notebook dimensions depending on container Width
      const containerWidth = containerRef.current?.clientWidth || 700;
      const notebookWidth = Math.min(680, containerWidth - 32);
      // standard physical vertical ratio (A4 approx)
      setDimensions({ width: notebookWidth, height: notebookWidth * 1.3 });
      return;
    }

    let isCancelled = false;
    const renderPage = async () => {
      setLoading(true);
      try {
        const page = await pdfDoc.getPage(pageNumber);
        
        // Base viewport scale
        const normalViewport = page.getViewport({ scale: 1.0 });
        
        // Calculate appropriate scale based on zoom setting
        const containerWidth = containerRef.current?.clientWidth || 700;
        const targetWidth = Math.min(normalViewport.width * zoom, containerWidth - 32);
        const dynamicScale = targetWidth / normalViewport.width;
        
        const viewport = page.getViewport({ scale: dynamicScale });
        
        if (isCancelled) return;
        
        setDimensions({ width: viewport.width, height: viewport.height });

        // Grab canvas and render inside Next Tick to ensure canvas DOM mounted properly
        setTimeout(async () => {
          const canvas = pdfCanvasRef.current;
          if (!canvas || isCancelled) return;
          const context = canvas.getContext('2d');
          if (!context) return;

          // Align DPR of background to match crispiness of drawings
          const dpr = window.devicePixelRatio || 1;
          canvas.width = viewport.width * dpr;
          canvas.height = viewport.height * dpr;
          context.scale(dpr, dpr);

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };

          await page.render(renderContext).promise;
          setLoading(false);
        }, 100);

      } catch (err) {
        console.error('Render page error:', err);
        setLoading(false);
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, pageNumber, zoom, pdfJsLoaded]);

  // Adjust canvas width when window/sidebar resizes
  useEffect(() => {
    const handleResize = () => {
      if (!pdfDoc) {
        const containerWidth = containerRef.current?.clientWidth || 700;
        const notebookWidth = Math.min(680, containerWidth - 32);
        setDimensions({ width: notebookWidth, height: notebookWidth * 1.3 });
      } else {
        // Trigger a slight state-toggle to re-render the viewport scale on window sizes
        setZoom((z) => z + 0.0001);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pdfDoc]);

  const handleZoom = (amount: number) => {
    setZoom((prev) => Math.max(0.6, Math.min(3.0, prev + amount)));
  };

  const handlePrevPage = () => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1);
    }
  };

  const handleNextPage = () => {
    if (pageNumber < totalPages) {
      setPageNumber(pageNumber + 1);
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col items-center flex-1 w-full h-full select-none">
      
      {/* PDF / Notebook Control Header bar in Artistic Theme */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-white border-4 border-[#1A1A1A] p-4.5 shadow-[4px_4px_0px_rgba(26,26,26,1)] mb-5 transition-all select-none">
        {/* Navigation block */}
        <div className="flex items-center gap-2">
          <button
            id="btn-prev-page"
            disabled={pageNumber === 1}
            onClick={handlePrevPage}
            className="p-1.5 border-2 border-[#1A1A1A] bg-white text-[#1A1A1A] hover:bg-[#FFD700] disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-[#1A1A1A] rounded-none cursor-pointer shadow-[2px_2px_0px_#1A1A1A] transition active:scale-95"
            title="Pagina precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="font-sans text-xs font-black text-[#1A1A1A] uppercase tracking-wider min-w-[110px] text-center font-mono select-none">
            PAG. {pageNumber} / {totalPages}
          </span>

          <button
            id="btn-next-page"
            disabled={pageNumber === totalPages}
            onClick={handleNextPage}
            className="p-1.5 border-2 border-[#1A1A1A] bg-white text-[#1A1A1A] hover:bg-[#FFD700] disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-[#1A1A1A] rounded-none cursor-pointer shadow-[2px_2px_0px_#1A1A1A] transition active:scale-95"
            title="Pagina successiva"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Add page button only when no PDF loaded */}
          {!pdfDoc && (
            <button
              id="btn-add-note-page"
              onClick={onAddBlankPage}
              className="flex items-center gap-1 px-3 py-1 text-[11px] font-black bg-white text-[#1A1A1A] hover:bg-[#FFD700] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] cursor-pointer transition uppercase"
              title="Aggiungi una pagina bianca al quaderno"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuova Pagina
            </button>
          )}
        </div>

        {/* Paper style selector for custom notebooks */}
        <div className="flex items-center gap-2 bg-[#F7F5F0] border-2 border-[#1A1A1A] p-1.5 rounded-lg">
          <span className="text-[9px] text-[#1A1A1A] font-black uppercase px-1.5 select-none font-mono tracking-widest opacity-60">
            FOGLIO
          </span>
          <div className="flex gap-1">
            {(pdfDoc ? (['pdf', 'lines', 'grid'] as const) : (['blank', 'lines', 'grid'] as const)).map((style) => (
              <button
                key={style}
                onClick={() => setPaperStyle(style as any)}
                className={`px-2.5 py-0.5 text-[11px] font-black border-2 select-none cursor-pointer transition ${
                  paperStyle === style
                    ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                    : 'bg-white text-[#1A1A1A] border-transparent hover:border-[#1A1A1A]/30'
                }`}
              >
                {style === 'pdf' ? 'PDF' : style === 'lines' ? 'RIGHE' : style === 'grid' ? 'QUADRETTI' : 'BIANCO'}
              </button>
            ))}
          </div>
        </div>

        {/* Zoom controls for PDF */}
        <div className="flex items-center gap-2">
          <button
            id="btn-zoom-out"
            onClick={() => handleZoom(-0.15)}
            className="p-1.5 border-2 border-[#1A1A1A] bg-white text-[#1A1A1A] hover:bg-[#FFD700] rounded-none cursor-pointer shadow-[2px_2px_0px_#1A1A1A] transition"
            title="Riduci Zoom"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs text-[#1A1A1A] font-black min-w-[45px] text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            id="btn-zoom-in"
            onClick={() => handleZoom(0.15)}
            className="p-1.5 border-2 border-[#1A1A1A] bg-white text-[#1A1A1A] hover:bg-[#FFD700] rounded-none cursor-pointer shadow-[2px_2px_0px_#1A1A1A] transition"
            title="Aumenta Zoom"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF / Canvas container block */}
      <div className="relative flex-1 w-full flex items-start justify-center overflow-auto pb-8 min-h-[500px]">
        {loading && (
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[#F7F5F0] border-4 border-[#1A1A1A] text-[#1A1A1A] rounded-none px-6 py-4 flex items-center justify-center gap-3 shadow-[8px_8px_0px_rgba(26,26,26,1)] font-sans text-xs font-black uppercase tracking-wider">
            <Loader2 className="w-5 h-5 animate-spin text-[#FF4D00]" />
            <span>Rendering Pagina...</span>
          </div>
        )}

        {pdfJsError && (
          <div className="bg-red-50 border-4 border-red-500 text-red-700 rounded-none p-4 text-center max-w-md my-8 shadow-[6px_6px_0px_rgba(239,68,68,0.3)]">
            <p className="font-black text-sm uppercase">Errore nel caricamento del motore PDF</p>
            <p className="text-xs mt-1 font-mono">{pdfJsError}</p>
          </div>
        )}

        <div
          id="pdf-study-workspace-frame"
          className="relative transition-all duration-150 ease-out shadow-[8px_8px_0px_#1A1A1A] border-4 border-[#1A1A1A] bg-white rounded-none overflow-hidden flex"
          style={{ width: dimensions.width, height: dimensions.height }}
        >
          {/* Paper template layout styling when PDF is NOT loaded or user wants to draw grids over PDF page */}
          <div className="absolute inset-0 z-0 bg-white" />

          {/* PDF image render background canvas */}
          {pdfDoc && paperStyle === 'pdf' && (
            <canvas
              ref={pdfCanvasRef}
              className="absolute inset-0 z-10 block pointer-events-none select-none"
              style={{ width: dimensions.width, height: dimensions.height }}
            />
          )}

          {/* Transparent overlaid vector board drawing system */}
          <DrawingCanvas
            strokes={strokes}
            onAddStroke={onAddStroke}
            onUndo={onUndo}
            onRedo={onRedo}
            onClear={onClear}
            canUndo={canUndo}
            canRedo={canRedo}
            tool={tool}
            color={color}
            strokeWidth={strokeWidth}
            width={dimensions.width}
            height={dimensions.height}
            paperStyle={pdfDoc && paperStyle === 'pdf' ? 'blank' : paperStyle as any}
            isPanning={isPanning}
          />
        </div>
      </div>
    </div>
  );
}
