/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';

export function usePdfJs() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if pdfjsLib already loaded in general window space
    if ((window as any).pdfjsLib) {
      setLoaded(true);
      return;
    }

    // Load main pdf.js file from Cloudflare / cdnjs
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        // Set worker location
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        setLoaded(true);
      } else {
        setError('Libreria PDF.js non trovata nello scope globale.');
      }
    };
    script.onerror = () => {
      setError('Caricamento della libreria PDF.js da CDN fallito.');
    };
    document.head.appendChild(script);
  }, []);

  return { loaded, error };
}
