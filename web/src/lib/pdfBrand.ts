import type { jsPDF } from 'jspdf';

type RGB = [number, number, number];

// The Mahanex wordmark for PDF headers: Mahan, a short dash and Ex (the
// dash and EX in the accent colour), then the product name in italics.
// jsPDF has no gradient text, so these are flat brand colours.
export function drawMahanexWordmark(doc: jsPDF, x: number, y: number, ink: RGB, accent: RGB): void {
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
