export interface MonthlyReportRow {
  id: string;
  customer_name: string;
  stock_number: string | null;
  fsm_name: string | null;
  // The scheduled delivery date, not when it was actually marked
  // delivered — a vehicle scheduled for Sep 30 but only marked delivered
  // on Oct 1 still belongs to, and reports under, September.
  delivery_at: string;
}

export interface HattrickMember {
  id: string;
  customer_name: string;
  stock_number: string | null;
  delivery_at: string;
}

// A hat-trick group is 3+ vehicles sold the same day (sold_at), detected
// automatically — never hand-picked. It only belongs on a report once every
// member has delivered, which can land in a later month than when some (or
// all) of its members were scheduled — so members are carried here in
// full, independent of which month's reportRows they also appear in.
export interface HattrickGroup {
  sold_at: string;
  completed_at: string;
  members: HattrickMember[];
}

export interface DealershipDetails {
  name: string;
  address: string;
  city: string;
  phone: string;
  dealerCode: string;
}

const NAVY: [number, number, number] = [30, 58, 138];
const SLATE: [number, number, number] = [51, 65, 85];
const LIGHT_GRAY: [number, number, number] = [238, 241, 244];
const MID_GRAY: [number, number, number] = [204, 210, 217];
const GOLD: [number, number, number] = [180, 83, 9];
const GOLD_BG: [number, number, number] = [254, 243, 199];
const MUTED: [number, number, number] = [107, 114, 128];
const DARK: [number, number, number] = [26, 26, 26];

// Parses a plain YYYY-MM-DD (no time component, e.g. a `date` column) as a
// local calendar date — new Date("2026-09-28") parses as UTC midnight,
// which can display as the previous day in western-hemisphere timezones.
function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// jsPDF drags in a heavy dependency chain (html2canvas, dompurify) that
// would otherwise bloat this PWA's precached bundle for a feature only
// salespeople use, occasionally. Loaded on demand instead, so it's a
// separate chunk fetched only when the report button is actually tapped.
async function buildPdf(
  rows: MonthlyReportRow[],
  salespersonName: string,
  monthLabel: string,
  dealership: DealershipDetails,
  hattrickGroups: HattrickGroup[],
) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentW = pageW - margin * 2;
  const bonusRowIds = new Set(hattrickGroups.flatMap((g) => g.members.map((m) => m.id)));

  // ---- header band ----
  const headerH = 92;
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(0, 0, pageW, headerH, 'F');
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...DARK);
  doc.text('AXIOM', margin, 36);
  const axiomW = doc.getTextWidth('AXIOM ');
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...NAVY);
  doc.text('Pulse', margin + axiomW, 36);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text('The Pulse of Every Delivery.', margin, 52);

  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175);
  doc.text('by Rahul Champaneri', margin, 68);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text('M O N T H L Y   D E L I V E R Y   R E P O R T', pageW - margin, 36, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(monthLabel.toUpperCase(), pageW - margin, 52, { align: 'right' });

  let y = headerH + 26;

  // ---- stat tiles ----
  const tileGap = 10;
  const tileW = (contentW - tileGap * 2) / 3;
  const tileH = 54;
  const tiles: [string, string][] = [['MONTH', monthLabel], ['TOTAL DELIVERED', String(rows.length)], ['SALESPERSON', salespersonName]];
  tiles.forEach(([label, value], i) => {
    const tx = margin + i * (tileW + tileGap);
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
    doc.setFontSize(15);
    doc.setTextColor(...NAVY);
    doc.text(value, tx + tileW / 2, y + 40, { align: 'center' });
  });

  y += tileH + 18;

  // ---- salesperson bar ----
  const barH = 24;
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, contentW, barH, 'F');
  doc.setDrawColor(...MID_GRAY);
  doc.rect(margin, y, contentW, barH, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(`SALESPERSON: ${salespersonName.toUpperCase()}`, margin + 10, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text('FOR ACCOUNTING REVIEW', pageW - margin - 10, y + 16, { align: 'right' });

  y += barH + 16;

  // ---- table ----
  const cols: { label: string; w: number }[] = [
    { label: 'Customer Name', w: contentW * 0.32 },
    { label: 'Stock #', w: contentW * 0.13 },
    { label: 'Finance Manager', w: contentW * 0.26 },
    { label: 'Date of Delivery', w: contentW * 0.17 },
    { label: 'Bonus', w: contentW * 0.12 },
  ];
  const rowH = 20;
  const headH = 22;

  doc.setFillColor(...SLATE);
  doc.rect(margin, y, contentW, headH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  let cx = margin + 8;
  cols.forEach((col) => { doc.text(col.label.toUpperCase(), cx, y + 15); cx += col.w; });

  let ry = y + headH;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  rows.forEach((r, i) => {
    const isBonus = bonusRowIds.has(r.id);
    if (isBonus) {
      doc.setFillColor(...GOLD_BG);
      doc.rect(margin, ry, contentW, rowH, 'F');
    } else if (i % 2 === 1) {
      doc.setFillColor(248, 249, 250);
      doc.rect(margin, ry, contentW, rowH, 'F');
    }
    doc.setTextColor(...DARK);
    let cellX = margin + 8;
    const values = [
      r.customer_name,
      r.stock_number || '—',
      r.fsm_name || '—',
      new Date(r.delivery_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    ];
    values.forEach((v, idx) => { doc.text(v, cellX, ry + 14); cellX += cols[idx].w; });
    if (isBonus) {
      // A unicode star glyph isn't in Helvetica's base encoding and
      // silently renders as the wrong character — a drawn dot avoids
      // the font gotcha entirely, and "BONUS" alone (vs. "HAT-TRICK")
      // comfortably fits this narrow column without running off the page.
      doc.setFillColor(...GOLD);
      doc.circle(cellX + 3, ry + 10, 2.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...GOLD);
      doc.text('BONUS', cellX + 9, ry + 13);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
    }
    ry += rowH;
  });
  doc.setDrawColor(...MID_GRAY);
  doc.setLineWidth(0.6);
  doc.line(margin, ry, margin + contentW, ry);

  y = ry + 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(`TOTAL DELIVERED: ${rows.length}`, margin, y);

  y += 20;

  // ---- hat-trick bonus summary ----
  // Each group lists every one of its members, even ones scheduled or
  // delivered in an earlier month — the group only appears here, on the
  // report for the month its LAST member was delivered, which is when the
  // bonus actually becomes payable.
  if (hattrickGroups.length > 0) {
    const lineH = 13;
    const groupHeaderH = 20;
    const groupGap = 8;
    const totalMemberLines = hattrickGroups.reduce((n, g) => n + g.members.length, 0);
    const boxH = 16 + hattrickGroups.length * groupHeaderH + totalMemberLines * lineH + (hattrickGroups.length - 1) * groupGap;

    doc.setFillColor(...GOLD_BG);
    doc.rect(margin, y, contentW, boxH, 'F');
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.rect(margin, y, contentW, boxH, 'S');

    let gy = y + 16;
    hattrickGroups.forEach((group, gi) => {
      doc.setFillColor(...GOLD);
      doc.circle(margin + 15, gy, 3.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...GOLD);
      const soldLabel = parseDateOnly(group.sold_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      doc.text(`HAT-TRICK BONUS — SOLD ${soldLabel.toUpperCase()} · ${group.members.length} VEHICLES`, margin + 24, gy + 4);
      gy += groupHeaderH;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      group.members.forEach((m) => {
        const deliveredLabel = new Date(m.delivery_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        doc.text(`${m.customer_name}${m.stock_number ? ` · #${m.stock_number}` : ''} · Delivered ${deliveredLabel}`, margin + 24, gy + 3);
        gy += lineH;
      });
      if (gi < hattrickGroups.length - 1) gy += groupGap;
    });

    y += boxH + 24;
  } else {
    y += 4;
  }

  // ---- authorization signatures ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text('AUTHORIZATION', margin, y);
  y += 32;

  const colW = (contentW - 24) / 2;
  const lineY = y + 30;
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.8);
  doc.line(margin, lineY, margin + colW - 20, lineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`${salespersonName} · Salesperson`, margin, lineY + 13);
  doc.text('Date: _______________', margin, lineY + 25);

  const x2 = margin + colW + 24;
  doc.line(x2, lineY, x2 + colW - 20, lineY);
  doc.text('Sales Manager (sign in person)', x2, lineY + 13);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.text('Signature authorizes this report for accounting', x2, lineY + 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Date: _______________', x2, lineY + 37);

  // ---- footer ----
  const pageH = doc.internal.pageSize.getHeight();
  const footerY = pageH - 34;
  doc.setDrawColor(...MID_GRAY);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 10, pageW - margin, footerY - 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const footerText = `${dealership.name} · ${dealership.address}, ${dealership.city} · ${dealership.phone} · Dealer Code ${dealership.dealerCode}`;
  doc.text(footerText, pageW / 2, footerY, { align: 'center' });
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, footerY + 14);
  doc.text('Page 1', pageW - margin, footerY + 14, { align: 'right' });

  return doc;
}

function filenameFor(monthLabel: string): string {
  return `axiom-pulse-deliveries-${monthLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`;
}

export async function downloadMonthlyReport(
  rows: MonthlyReportRow[],
  salespersonName: string,
  monthLabel: string,
  dealership: DealershipDetails,
  hattrickGroups: HattrickGroup[] = [],
): Promise<void> {
  const doc = await buildPdf(rows, salespersonName, monthLabel, dealership, hattrickGroups);
  doc.save(filenameFor(monthLabel));
}

// Native share sheet (Mail, Gmail, Messages, etc.) with the PDF attached —
// the only cross-platform way to hand a generated file to an email app
// without a backend mail service. Falls back to a plain download when the
// browser doesn't support sharing files (most desktop browsers).
export async function shareMonthlyReport(
  rows: MonthlyReportRow[],
  salespersonName: string,
  monthLabel: string,
  dealership: DealershipDetails,
  hattrickGroups: HattrickGroup[] = [],
): Promise<'shared' | 'downloaded'> {
  const doc = await buildPdf(rows, salespersonName, monthLabel, dealership, hattrickGroups);
  const filename = filenameFor(monthLabel);
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: 'Axiom Pulse — Monthly Delivery Report',
        text: `Deliveries for ${salespersonName} — ${monthLabel}`,
      });
      return 'shared';
    } catch {
      // User cancelled the share sheet, or it failed — fall through to download.
    }
  }
  doc.save(filename);
  return 'downloaded';
}
