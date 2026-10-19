import type { jsPDF } from 'jspdf';
import { mhMark } from './mhMark';

type RGB = [number, number, number];

const MARK_PT = 30;

// The hexagon mark as a PNG (jsPDF can't draw SVG), rendered once at 4x for
// a crisp print. Null if the browser can't rasterize it — the header then
// falls back to the wordmark alone.
let markPng: Promise<string | null> | null = null;
function mahanexMarkPng(): Promise<string | null> {
  markPng ??= new Promise((resolve) => {
    const px = MARK_PT * 4;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = px;
      canvas.height = px;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, px, px);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mhMark({ label: '' }))}`;
  });
  return markPng;
}

// The Mahanex logo for PDF headers: the hexagon mark, then Mahan, a short
// dash and Ex (the dash and EX in the accent colour), then the product name
// in italics. jsPDF has no gradient text, so these are flat brand colours.
export async function drawMahanexWordmark(doc: jsPDF, x: number, y: number, ink: RGB, accent: RGB): Promise<void> {
  const mark = await mahanexMarkPng();
  if (mark) {
    doc.addImage(mark, 'PNG', x, y - MARK_PT + 7, MARK_PT, MARK_PT);
    x += MARK_PT + 8;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(...ink);
  doc.text('Mahan', x, y, { charSpace: 0.4 });
  let cursor = x + doc.getTextWidth('Mahan') + 5 * 0.4;
  doc.setFillColor(...accent);
  doc.roundedRect(cursor + 1, y - 8.5, 7, 2.4, 1, 1, 'F');
  cursor += 10;
  doc.setTextColor(...accent);
  doc.text('Ex', cursor, y, { charSpace: 0.4 });
  cursor += doc.getTextWidth('Ex') + 2 * 0.4 + 8;
  doc.setFont('helvetica', 'bolditalic');
  doc.text('Pulse', cursor, y);
}
