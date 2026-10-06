import type { DealershipDetails } from './monthlyReport';
import type { VehicleCondition } from './types';

export interface DealershipReportRow {
  id: string;
  customer_name: string;
  stock_number: string | null;
  salesperson_name: string | null;
  fsm_name: string | null;
  delivery_at: string;
  vehicle_condition: VehicleCondition | null;
}

const NAVY: [number, number, number] = [30, 58, 138];
const SLATE: [number, number, number] = [51, 65, 85];
const LIGHT_GRAY: [number, number, number] = [238, 241, 244];
const MID_GRAY: [number, number, number] = [204, 210, 217];
const MUTED: [number, number, number] = [107, 114, 128];
const DARK: [number, number, number] = [26, 26, 26];

const MARGIN = 40;
const FOOTER_RESERVE = 48;
const ROW_H = 20;
const ROW_FONT = 9.5;
const ROW_TEXT_OFFSET = ROW_H - 6;
const HEAD_H = 22;

const COLS: { label: string; w: number }[] = [
  { label: 'Customer Name', w: 0.24 },
  { label: 'Stock #', w: 0.10 },
  { label: 'Salesperson', w: 0.22 },
  { label: 'Finance Manager', w: 0.22 },
  { label: 'Date of Delivery', w: 0.22 },
];

// A Sales Manager's report is a read-only summary of what's delivered
// dealership-wide — unlike the salesperson's monthly report, it has no
// bonus content (that's personal payroll info) and no signature block
// (nothing here needs authorizing). New and used vehicles print as two
// fully separate tables (their own section header and subtotal) rather
// than a shared table with a condition column, since that's what's
// actually easier to read off a printed page — multiple pages are fine
// here, unlike the one-page bonus report.
async function buildPdf(rows: DealershipReportRow[], dealershipName: string, monthLabel: string, generatedBy: string, dealership: DealershipDetails) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const usableBottom = pageH - FOOTER_RESERVE;
  const cols = COLS.map((c) => ({ label: c.label, w: c.w * contentW }));

  const newRows = rows.filter((r) => r.vehicle_condition === 'new');
  const usedRows = rows.filter((r) => r.vehicle_condition === 'used');
  const unspecifiedRows = rows.filter((r) => !r.vehicle_condition);

  let pageNum = 1;

  const drawFooter = () => {
    const footerY = pageH - 34;
    doc.setDrawColor(...MID_GRAY);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, footerY - 10, pageW - MARGIN, footerY - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    const footerText = `${dealership.name} · ${dealership.address}, ${dealership.city} · ${dealership.phone} · Dealer Code ${dealership.dealerCode}`;
    doc.text(footerText, pageW / 2, footerY, { align: 'center' });
    doc.text(`Generated ${new Date().toLocaleString()}`, MARGIN, footerY + 14);
    doc.text(`Page ${pageNum}`, pageW - MARGIN, footerY + 14, { align: 'right' });
  };

  // ---- header band (page 1 only — a full masthead on every page would
  // eat too much space once a report runs to several pages) ----
  const headerH = 92;
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(0, 0, pageW, headerH, 'F');
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...DARK);
  doc.text('AXIOM', MARGIN, 36);
  const axiomW = doc.getTextWidth('AXIOM ');
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...NAVY);
  doc.text('Pulse', MARGIN + axiomW, 36);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text('The Pulse of Every Delivery.', MARGIN, 52);

  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175);
  doc.text('by Rahul Champaneri', MARGIN, 68);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text('D E A L E R S H I P   D E L I V E R Y   R E P O R T', pageW - MARGIN, 36, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(monthLabel.toUpperCase(), pageW - MARGIN, 52, { align: 'right' });

  let y = headerH + 26;

  const newCount = newRows.length;
  const usedCount = usedRows.length;

  // ---- stat tiles ----
  const tileGap = 10;
  const tileW = (contentW - tileGap * 3) / 4;
  const tileH = 54;
  const tiles: [string, string][] = [
    ['MONTH', monthLabel],
    ['TOTAL DELIVERED', String(rows.length)],
    ['NEW', String(newCount)],
    ['USED', String(usedCount)],
  ];
  tiles.forEach(([label, value], i) => {
    const tx = MARGIN + i * (tileW + tileGap);
    doc.setFillColor(255, 255, 255);
    doc.rect(tx, y, tileW, tileH, 'F');
    doc.setDrawColor(...MID_GRAY);
    doc.setLineWidth(0.8);
    doc.rect(tx, y, tileW, tileH, 'S');
    doc.setFillColor(...NAVY);
    doc.rect(tx, y, 2.5, tileH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label, tx + tileW / 2, y + 18, { align: 'center' });
    doc.setFontSize(value.length > 14 ? 11 : 15);
    doc.setTextColor(...NAVY);
    doc.text(value, tx + tileW / 2, y + 40, { align: 'center' });
  });

  y += tileH + 16;

  // ---- generated-by bar ----
  const barH = 24;
  doc.setFillColor(255, 255, 255);
  doc.rect(MARGIN, y, contentW, barH, 'F');
  doc.setDrawColor(...MID_GRAY);
  doc.rect(MARGIN, y, contentW, barH, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(`${dealershipName.toUpperCase()} · GENERATED BY: ${generatedBy.toUpperCase()}`, MARGIN + 10, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageW - MARGIN - 10, y + 16, { align: 'right' });

  y += barH + 24;

  const startNewPage = () => {
    drawFooter();
    doc.addPage();
    pageNum += 1;
    y = MARGIN;
  };

  // Keeps a section's title + table header glued to at least its first
  // row — never let a section open at the very bottom of a page with
  // nothing under it.
  const ensureSpace = (neededH: number) => {
    if (y + neededH > usableBottom) startNewPage();
  };

  const drawTableHead = () => {
    doc.setFillColor(...SLATE);
    doc.rect(MARGIN, y, contentW, HEAD_H, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    let cx = MARGIN + 8;
    cols.forEach((col) => { doc.text(col.label.toUpperCase(), cx, y + 15); cx += col.w; });
    y += HEAD_H;
  };

  const drawSection = (title: string, sectionRows: DealershipReportRow[], accent: [number, number, number]) => {
    if (sectionRows.length === 0) return;

    ensureSpace(24 + HEAD_H + ROW_H);
    doc.setFillColor(...accent);
    doc.rect(MARGIN, y, 3, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...DARK);
    doc.text(`${title} (${sectionRows.length})`, MARGIN + 10, y + 12);
    y += 22;

    drawTableHead();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(ROW_FONT);
    sectionRows.forEach((r, i) => {
      ensureSpace(ROW_H);
      // A fresh page mid-section needs its own column header so a reader
      // who flips straight to that page still knows what each column is.
      if (y === MARGIN) drawTableHead();
      if (i % 2 === 1) {
        doc.setFillColor(248, 249, 250);
        doc.rect(MARGIN, y, contentW, ROW_H, 'F');
      }
      doc.setTextColor(...DARK);
      let cellX = MARGIN + 8;
      const values = [
        r.customer_name,
        r.stock_number || '—',
        r.salesperson_name || '—',
        r.fsm_name || '—',
        new Date(r.delivery_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      ];
      values.forEach((v, idx) => { doc.text(v, cellX, y + ROW_TEXT_OFFSET); cellX += cols[idx].w; });
      y += ROW_H;
    });
    doc.setDrawColor(...MID_GRAY);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, y, MARGIN + contentW, y);

    y += 24;
  };

  drawSection('NEW VEHICLES', newRows, NAVY);
  drawSection('USED VEHICLES', usedRows, [180, 83, 9]);
  drawSection('CONDITION NOT RECORDED', unspecifiedRows, MUTED);

  ensureSpace(32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(`TOTAL DELIVERED: ${rows.length}  ·  New: ${newCount}  ·  Used: ${usedCount}`, MARGIN, y);

  drawFooter();

  return doc;
}

function filenameFor(monthLabel: string): string {
  return `axiom-pulse-dealership-report-${monthLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`;
}

export async function downloadDealershipReport(
  rows: DealershipReportRow[],
  dealershipName: string,
  monthLabel: string,
  generatedBy: string,
  dealership: DealershipDetails,
): Promise<void> {
  const doc = await buildPdf(rows, dealershipName, monthLabel, generatedBy, dealership);
  doc.save(filenameFor(monthLabel));
}

export async function shareDealershipReport(
  rows: DealershipReportRow[],
  dealershipName: string,
  monthLabel: string,
  generatedBy: string,
  dealership: DealershipDetails,
): Promise<'shared' | 'downloaded'> {
  const doc = await buildPdf(rows, dealershipName, monthLabel, generatedBy, dealership);
  const filename = filenameFor(monthLabel);
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Axiom Pulse — Dealership Delivery Report', text: `Deliveries — ${monthLabel}` });
      return 'shared';
    } catch {
      // User cancelled the share sheet, or it failed — fall through to download.
    }
  }
  doc.save(filename);
  return 'downloaded';
}
