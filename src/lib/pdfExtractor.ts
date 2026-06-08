import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type !== 'application/pdf') {
    // For images, return a placeholder — Claude will use vision on the base64
    return '';
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ')
      .replace(/\s{3,}/g, '  ')
      .trim();
    if (pageText) pages.push(`[Page ${i}]\n${pageText}`);
  }

  return pages.join('\n\n');
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Renders each page of a PDF as a JPEG image using PDF.js and canvas.
 * Used for large scanned PDFs where text extraction yields nothing.
 * Pages are scaled to TARGET_WIDTH on the longest side and compressed
 * to JPEG at the given quality to keep payloads small.
 */
export async function renderPdfPagesAsJpeg(
  file: File,
  maxPages = 15,
  quality = 0.65,
): Promise<Array<{ base64: string; mimeType: 'image/jpeg' }>> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = Math.min(pdf.numPages, maxPages);
  const TARGET_WIDTH = 1280;
  const results: Array<{ base64: string; mimeType: 'image/jpeg' }> = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const defaultViewport = page.getViewport({ scale: 1 });
    const scale = TARGET_WIDTH / defaultViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable.');

    await page.render({ canvasContext: ctx, viewport, canvas } as Parameters<typeof page.render>[0]).promise;

    const base64 = await new Promise<string>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error(`Page ${i} canvas export failed.`)); return; }
          const reader = new FileReader();
          reader.onload  = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        quality,
      );
    });

    results.push({ base64, mimeType: 'image/jpeg' });
  }

  return results;
}
