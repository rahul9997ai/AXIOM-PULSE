import type { jsPDF } from 'jspdf';

type RGB = [number, number, number];

// The Mahanex wordmark for PDF headers: MAHAN, a short dash and EX (the
// dash and EX in the accent colour), then the product name in italics.
// jsPDF has no gradient text, so these are flat brand colours.
export function drawMahanexWordmark(doc: jsPDF, x: number, y: number, ink: RGB, accent: RGB): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(...ink);
  doc.text('MAHAN', x, y, { charSpace: 1.6 });
  let cursor = x + doc.getTextWidth('MAHAN') + 5 * 1.6;
  doc.setFillColor(...accent);
  doc.roundedRect(cursor + 1, y - 8.5, 7, 2.4, 1, 1, 'F');
  cursor += 10;
  doc.setTextColor(...accent);
  doc.text('EX', cursor, y, { charSpace: 1.6 });
  cursor += doc.getTextWidth('EX') + 2 * 1.6 + 8;
  doc.setFont('helvetica', 'bolditalic');
  doc.text('Pulse', cursor, y);
}
